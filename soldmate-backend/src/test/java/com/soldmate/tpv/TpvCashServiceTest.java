package com.soldmate.tpv;

import com.soldmate.activity.ActivityLogger;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Arqueo de caja. La fórmula del efectivo esperado es:
 * fondo inicial + ventas en efectivo + entradas − salidas.
 */
@ExtendWith(MockitoExtension.class)
class TpvCashServiceTest {

    private static final Long COMPANY_ID = 1L;
    private static final Long SESSION_ID = 77L;
    private static final String EMAIL = "encargado@laterracita.es";
    private static final LocalDate DAY = LocalDate.of(2026, 7, 31);

    @Mock private TpvCashSessionRepository sessionRepository;
    @Mock private TpvCashMovementRepository movementRepository;
    @Mock private TpvPaymentRepository paymentRepository;
    @Mock private CompanyRepository companyRepository;
    @Mock private ActivityLogger activityLogger;

    @InjectMocks private TpvCashService service;

    private Company company;
    private TpvCashSession session;

    @BeforeEach
    void setUp() {
        company = new Company();
        company.setId(COMPANY_ID);

        session = new TpvCashSession();
        session.setId(SESSION_ID);
        session.setCompany(company);
        session.setBusinessDay(DAY);
        session.setStatus(TpvCashSession.Status.OPEN);
        session.setOpeningFloat(new BigDecimal("150.00"));
        session.setOpenedBy(EMAIL);
    }

    private static void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual),
            () -> "esperado " + expected + " pero fue " + actual);
    }

    private void givenOpenSession() {
        when(sessionRepository.findFirstByCompany_IdAndStatusOrderByOpenedAtDesc(
            COMPANY_ID, TpvCashSession.Status.OPEN)).thenReturn(Optional.of(session));
    }

    private TpvCashMovement movement(TpvCashMovement.Type type, String amount) {
        TpvCashMovement m = new TpvCashMovement();
        m.setId(1L);
        m.setCompany(company);
        m.setSession(session);
        m.setType(type);
        m.setAmount(new BigDecimal(amount));
        return m;
    }

    private TpvPayment payment(TpvPayment.Method method, String amount) {
        TpvPayment p = new TpvPayment();
        p.setMethod(method);
        p.setAmount(new BigDecimal(amount));
        return p;
    }

    @Test
    @DisplayName("el efectivo esperado = fondo + ventas en efectivo + entradas − salidas")
    void expectedCashFollowsArqueoFormula() {
        givenOpenSession();
        when(movementRepository.findBySession_IdOrderByIdAsc(SESSION_ID)).thenReturn(List.of(
            movement(TpvCashMovement.Type.IN, "50.00"),
            movement(TpvCashMovement.Type.OUT, "30.00")));
        when(paymentRepository.findForBusinessDay(eq(COMPANY_ID), eq(DAY), any()))
            .thenReturn(List.of(payment(TpvPayment.Method.CASH, "200.00")));

        // 150 + 200 + 50 − 30 = 370
        TpvCashService.CloseResult result =
            service.close(COMPANY_ID, EMAIL, new BigDecimal("370.00"), null);

        assertMoney("150.00", result.openingFloat());
        assertMoney("200.00", result.cashSales());
        assertMoney("50.00", result.movementsIn());
        assertMoney("30.00", result.movementsOut());
        assertMoney("370.00", result.expectedCash());
        assertMoney("0.00", result.difference());
        assertEquals(TpvCashSession.Status.CLOSED, session.getStatus());
    }

    @Test
    @DisplayName("si falta dinero en el cajón el descuadre sale negativo")
    void missingCashProducesNegativeDifference() {
        givenOpenSession();
        when(movementRepository.findBySession_IdOrderByIdAsc(SESSION_ID)).thenReturn(List.of());
        when(paymentRepository.findForBusinessDay(eq(COMPANY_ID), eq(DAY), any()))
            .thenReturn(List.of(payment(TpvPayment.Method.CASH, "100.00")));

        // esperado 250, contado 240 → −10
        TpvCashService.CloseResult result =
            service.close(COMPANY_ID, EMAIL, new BigDecimal("240.00"), "faltan 10");

        assertMoney("250.00", result.expectedCash());
        assertMoney("-10.00", result.difference());
        assertEquals("faltan 10", session.getNote());
    }

    @Test
    @DisplayName("solo cuentan como caja los cobros en efectivo, no tarjeta ni plataforma")
    void onlyCashPaymentsCountTowardsDrawer() {
        givenOpenSession();
        when(movementRepository.findBySession_IdOrderByIdAsc(SESSION_ID)).thenReturn(List.of());
        when(paymentRepository.findForBusinessDay(eq(COMPANY_ID), eq(DAY), any())).thenReturn(List.of(
            payment(TpvPayment.Method.CASH, "40.00"),
            payment(TpvPayment.Method.CARD, "500.00"),
            payment(TpvPayment.Method.DELIVERY_PLATFORM, "80.00")));

        TpvCashService.CashState state = service.current(COMPANY_ID);

        assertMoney("40.00", state.cashSales());
        assertMoney("190.00", state.expectedCash()); // 150 de fondo + 40 en efectivo
    }

    @Test
    @DisplayName("sin caja abierta el estado se devuelve vacío y cerrado")
    void currentWithoutOpenSessionReturnsClosedState() {
        when(sessionRepository.findFirstByCompany_IdAndStatusOrderByOpenedAtDesc(
            COMPANY_ID, TpvCashSession.Status.OPEN)).thenReturn(Optional.empty());

        TpvCashService.CashState state = service.current(COMPANY_ID);

        assertFalse(state.open(), "no debe reportar caja abierta");
        assertMoney("0.00", state.expectedCash());
        assertEquals(List.of(), state.movements());
    }

    @Test
    @DisplayName("no se puede abrir una caja si ya hay una abierta")
    void openRejectsWhenAlreadyOpen() {
        givenOpenSession();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.open(COMPANY_ID, EMAIL, new BigDecimal("150.00")));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        verify(sessionRepository, never()).save(any());
    }

    @Test
    @DisplayName("no se pueden registrar movimientos sin caja abierta")
    void movementRequiresOpenSession() {
        when(sessionRepository.findFirstByCompany_IdAndStatusOrderByOpenedAtDesc(
            COMPANY_ID, TpvCashSession.Status.OPEN)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.addMovement(COMPANY_ID, EMAIL, "IN", new BigDecimal("10.00"), "propina"));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        verify(movementRepository, never()).save(any());
    }

    @Test
    @DisplayName("rechaza un tipo de movimiento desconocido")
    void movementRejectsUnknownType() {
        givenOpenSession();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.addMovement(COMPANY_ID, EMAIL, "REGALO", new BigDecimal("10.00"), null));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        verify(movementRepository, never()).save(any());
    }

    @Test
    @DisplayName("rechaza importes no positivos en los movimientos")
    void movementRejectsNonPositiveAmount() {
        givenOpenSession();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.addMovement(COMPANY_ID, EMAIL, "OUT", BigDecimal.ZERO, "proveedor"));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        verify(movementRepository, never()).save(any());
        verify(activityLogger, never()).log(anyLong(), any(), any(), any(), any());
    }
}
