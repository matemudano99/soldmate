package com.soldmate.tpv;

import com.soldmate.activity.ActivityLogger;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import com.soldmate.predictive.SaleRecord;
import com.soldmate.predictive.SaleRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Lógica de negocio de la comanda: importes (descuentos e IVA), cobro y aislamiento por empresa.
 * Los precios son BRUTOS (IVA incluido), así que la base se obtiene dividiendo por (1 + tipo/100).
 */
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    private static final Long COMPANY_ID = 1L;
    private static final Long ORDER_ID = 100L;
    private static final String EMAIL = "encargado@laterracita.es";

    @Mock private TpvOrderRepository orderRepository;
    @Mock private TpvOrderLineRepository lineRepository;
    @Mock private TpvPaymentRepository paymentRepository;
    @Mock private MenuItemRepository menuItemRepository;
    @Mock private TpvTableRepository tableRepository;
    @Mock private TpvCustomerService customerService;
    @Mock private CompanyRepository companyRepository;
    @Mock private StockDeductionService stockDeductionService;
    @Mock private SaleRecordRepository saleRecordRepository;
    @Mock private ActivityLogger activityLogger;

    @InjectMocks private OrderService service;

    private Company company;
    private TpvOrder order;

    @BeforeEach
    void setUp() {
        company = new Company();
        company.setId(COMPANY_ID);

        order = new TpvOrder();
        order.setId(ORDER_ID);
        order.setCompany(company);
        order.setStatus(TpvOrder.Status.OPEN);
        order.setChannel(TpvOrder.Channel.DINE_IN);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    /** Compara importes por valor, no por escala (2.5 y 2.50 son el mismo dinero). */
    private static void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual),
            () -> "esperado " + expected + " pero fue " + actual);
    }

    private TpvOrderLine line(Long id, String unitPrice, String qty, String vatRate) {
        TpvOrderLine l = new TpvOrderLine();
        l.setId(id);
        l.setOrder(order);
        l.setCompany(company);
        l.setNameSnapshot("Cheeseburger");
        l.setUnitPrice(new BigDecimal(unitPrice));
        l.setQty(new BigDecimal(qty));
        l.setVatRate(new BigDecimal(vatRate));
        // El total de línea lo mantiene el servicio; aquí partimos del valor sin descuento.
        l.setLineTotal(new BigDecimal(unitPrice).multiply(new BigDecimal(qty)));
        return l;
    }

    private void givenOpenOrder() {
        when(orderRepository.findByIdAndCompany_Id(ORDER_ID, COMPANY_ID)).thenReturn(Optional.of(order));
    }

    private void givenLines(TpvOrderLine... lines) {
        when(lineRepository.findByOrder_IdAndVoidedFalse(ORDER_ID)).thenReturn(List.of(lines));
    }

    private void givenOrderSaveReturnsArgument() {
        when(orderRepository.save(any(TpvOrder.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    // ─── Descuento por línea ────────────────────────────────────────────────────

    @Nested
    @DisplayName("Descuento de línea")
    class LineDiscount {

        @Test
        @DisplayName("aplica el % a la línea y recalcula base/IVA del ticket")
        void appliesPercentAndRecomputesTotals() {
            TpvOrderLine l = line(500L, "10.00", "1", "10.00");
            givenOpenOrder();
            when(lineRepository.findById(500L)).thenReturn(Optional.of(l));
            givenLines(l);
            givenOrderSaveReturnsArgument();

            TpvOrder result = service.setLineDiscount(COMPANY_ID, ORDER_ID, 500L, new BigDecimal("50"));

            assertMoney("50.00", l.getDiscountPct());
            assertMoney("5.00", l.getLineTotal());
            assertMoney("5.00", result.getTotal());
            // 5,00 brutos al 10% → base 4,55 + IVA 0,45
            assertMoney("4.55", result.getSubtotal());
            assertMoney("0.45", result.getTaxTotal());
        }

        @Test
        @DisplayName("invitar (100%) deja la línea a cero")
        void hundredPercentMakesLineFree() {
            TpvOrderLine l = line(500L, "13.90", "2", "10.00");
            givenOpenOrder();
            when(lineRepository.findById(500L)).thenReturn(Optional.of(l));
            givenLines(l);
            givenOrderSaveReturnsArgument();

            TpvOrder result = service.setLineDiscount(COMPANY_ID, ORDER_ID, 500L, new BigDecimal("100"));

            assertMoney("0.00", l.getLineTotal());
            assertMoney("0.00", result.getTotal());
        }

        @Test
        @DisplayName("recorta por encima de 100 y por debajo de 0")
        void clampsOutOfRangeValues() {
            TpvOrderLine l = line(500L, "10.00", "1", "10.00");
            givenOpenOrder();
            when(lineRepository.findById(500L)).thenReturn(Optional.of(l));
            givenLines(l);
            givenOrderSaveReturnsArgument();

            service.setLineDiscount(COMPANY_ID, ORDER_ID, 500L, new BigDecimal("150"));
            assertMoney("100.00", l.getDiscountPct());
            assertMoney("0.00", l.getLineTotal());

            service.setLineDiscount(COMPANY_ID, ORDER_ID, 500L, new BigDecimal("-20"));
            assertMoney("0.00", l.getDiscountPct());
            assertMoney("10.00", l.getLineTotal());
        }

        @Test
        @DisplayName("no permite tocar una línea de otra empresa")
        void rejectsLineFromAnotherCompany() {
            Company other = new Company();
            other.setId(99L);
            TpvOrderLine foreign = line(500L, "10.00", "1", "10.00");
            foreign.setCompany(other);

            givenOpenOrder();
            when(lineRepository.findById(500L)).thenReturn(Optional.of(foreign));

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.setLineDiscount(COMPANY_ID, ORDER_ID, 500L, new BigDecimal("50")));

            assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
            verify(lineRepository, never()).save(any());
        }
    }

    // ─── Descuento de ticket ────────────────────────────────────────────────────

    @Nested
    @DisplayName("Descuento de ticket")
    class OrderDiscount {

        @Test
        @DisplayName("por porcentaje: escala total y mantiene la proporción base/IVA")
        void percentScalesProportionally() {
            TpvOrderLine l = line(500L, "100.00", "1", "10.00");
            givenOpenOrder();
            givenLines(l);
            givenOrderSaveReturnsArgument();

            TpvOrder result = service.setOrderDiscount(COMPANY_ID, ORDER_ID,
                TpvOrder.DiscountType.PERCENT, new BigDecimal("10"), "Fidelidad");

            assertMoney("90.00", result.getTotal());
            assertMoney("81.82", result.getSubtotal());
            assertMoney("8.18", result.getTaxTotal());
            assertEquals("Fidelidad", result.getDiscountReason());
            // La suma base + IVA debe seguir cuadrando con el total cobrado.
            assertMoney("90.00", result.getSubtotal().add(result.getTaxTotal()));
        }

        @Test
        @DisplayName("por importe: descuenta los euros indicados")
        void amountSubtractsFixedValue() {
            TpvOrderLine l = line(500L, "100.00", "1", "10.00");
            givenOpenOrder();
            givenLines(l);
            givenOrderSaveReturnsArgument();

            TpvOrder result = service.setOrderDiscount(COMPANY_ID, ORDER_ID,
                TpvOrder.DiscountType.AMOUNT, new BigDecimal("20"), null);

            assertMoney("80.00", result.getTotal());
            assertMoney("80.00", result.getSubtotal().add(result.getTaxTotal()));
        }

        @Test
        @DisplayName("quitarlo (NONE) restaura el total y borra el motivo")
        void noneRestoresFullTotal() {
            TpvOrderLine l = line(500L, "100.00", "1", "10.00");
            order.setDiscountType(TpvOrder.DiscountType.PERCENT);
            order.setDiscountValue(new BigDecimal("10"));
            order.setDiscountReason("Fidelidad");

            givenOpenOrder();
            givenLines(l);
            givenOrderSaveReturnsArgument();

            TpvOrder result = service.setOrderDiscount(COMPANY_ID, ORDER_ID,
                TpvOrder.DiscountType.NONE, BigDecimal.ZERO, "ignorado");

            assertMoney("100.00", result.getTotal());
            assertEquals(TpvOrder.DiscountType.NONE, result.getDiscountType());
            assertNull(result.getDiscountReason(), "al quitar el descuento no debe quedar motivo");
        }

        @Test
        @DisplayName("nunca deja el total en negativo aunque el importe supere la cuenta")
        void neverGoesNegative() {
            TpvOrderLine l = line(500L, "10.00", "1", "10.00");
            givenOpenOrder();
            givenLines(l);
            givenOrderSaveReturnsArgument();

            TpvOrder result = service.setOrderDiscount(COMPANY_ID, ORDER_ID,
                TpvOrder.DiscountType.AMOUNT, new BigDecimal("999"), "Error de caja");

            assertTrue(result.getTotal().signum() >= 0, "el total no puede ser negativo");
            assertMoney("0.00", result.getTotal());
        }
    }

    // ─── Importe bruto (para calcular el descuento mostrado) ────────────────────

    @Test
    @DisplayName("rawGross suma precio×cantidad ignorando los descuentos aplicados")
    void rawGrossIgnoresDiscounts() {
        TpvOrderLine discounted = line(500L, "10.00", "2", "10.00");
        discounted.setDiscountPct(new BigDecimal("50"));
        discounted.setLineTotal(new BigDecimal("10.00")); // ya rebajada
        TpvOrderLine plain = line(501L, "5.00", "1", "10.00");
        givenLines(discounted, plain);

        assertMoney("25.00", service.rawGross(ORDER_ID));
    }

    // ─── Cobro ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Cobro")
    class Payments {

        @Test
        @DisplayName("un pago parcial deja la comanda abierta y no descuenta stock")
        void partialPaymentKeepsOrderOpen() {
            order.setTotal(new BigDecimal("50.00"));
            givenOpenOrder();
            TpvPayment done = new TpvPayment();
            done.setAmount(new BigDecimal("20.00"));
            when(paymentRepository.findByOrder_IdOrderByIdAsc(ORDER_ID)).thenReturn(List.of(done));
            givenOrderSaveReturnsArgument();

            TpvOrder result = service.addPayment(COMPANY_ID, EMAIL, ORDER_ID,
                TpvPayment.Method.CARD, new BigDecimal("20.00"), null, null);

            assertEquals(TpvOrder.Status.OPEN, result.getStatus());
            verify(stockDeductionService, never()).deductForOrder(anyLong(), any());
            verify(saleRecordRepository, never()).save(any());
        }

        @Test
        @DisplayName("al cubrir el total marca PAID, descuenta stock y registra la venta")
        void coveringPaymentClosesOrder() {
            order.setTotal(new BigDecimal("50.00"));
            TpvOrderLine l = line(500L, "50.00", "1", "10.00");
            givenOpenOrder();
            TpvPayment first = new TpvPayment();
            first.setAmount(new BigDecimal("20.00"));
            TpvPayment second = new TpvPayment();
            second.setAmount(new BigDecimal("30.00"));
            when(paymentRepository.findByOrder_IdOrderByIdAsc(ORDER_ID)).thenReturn(List.of(first, second));
            when(lineRepository.findByOrder_IdAndVoidedFalse(ORDER_ID)).thenReturn(List.of(l));
            givenOrderSaveReturnsArgument();

            TpvOrder result = service.addPayment(COMPANY_ID, EMAIL, ORDER_ID,
                TpvPayment.Method.CASH, new BigDecimal("30.00"), null, null);

            assertEquals(TpvOrder.Status.PAID, result.getStatus());
            assertNotNull(result.getClosedAt(), "debe quedar sellada la hora de cierre");
            verify(stockDeductionService).deductForOrder(COMPANY_ID, List.of(l));
            verify(saleRecordRepository).save(any(SaleRecord.class));
            verify(activityLogger).log(eq(COMPANY_ID), anyString(), anyString(), anyString(), anyString());
        }

        @Test
        @DisplayName("guarda la propina junto al pago")
        void storesTip() {
            order.setTotal(new BigDecimal("50.00"));
            givenOpenOrder();
            when(paymentRepository.findByOrder_IdOrderByIdAsc(ORDER_ID)).thenReturn(List.of());
            givenOrderSaveReturnsArgument();

            service.addPayment(COMPANY_ID, EMAIL, ORDER_ID,
                TpvPayment.Method.CARD, new BigDecimal("20.00"), new BigDecimal("2.50"), null);

            org.mockito.ArgumentCaptor<TpvPayment> captor =
                org.mockito.ArgumentCaptor.forClass(TpvPayment.class);
            verify(paymentRepository).save(captor.capture());
            assertMoney("2.50", captor.getValue().getTip());
            assertMoney("20.00", captor.getValue().getAmount());
        }

        @Test
        @DisplayName("rechaza cobrar dos veces la misma comanda")
        void rejectsPaymentOnPaidOrder() {
            order.setStatus(TpvOrder.Status.PAID);
            givenOpenOrder();

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.addPayment(COMPANY_ID, EMAIL, ORDER_ID,
                    TpvPayment.Method.CASH, new BigDecimal("10.00"), null, null));

            assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
            verify(paymentRepository, never()).save(any());
        }

        @Test
        @DisplayName("rechaza importes no positivos")
        void rejectsNonPositiveAmount() {
            givenOpenOrder();

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.addPayment(COMPANY_ID, EMAIL, ORDER_ID,
                    TpvPayment.Method.CASH, BigDecimal.ZERO, null, null));

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
            verify(paymentRepository, never()).save(any());
        }
    }

    // ─── Líneas ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Añadir líneas")
    class AddLine {

        private MenuItem burger() {
            MenuItem item = new MenuItem();
            item.setId(7L);
            item.setName("Cheeseburger");
            item.setPrice(new BigDecimal("9.90"));
            item.setVatRate(new BigDecimal("10.00"));
            item.setAvailable(true);
            return item;
        }

        @Test
        @DisplayName("un artículo agotado no se puede añadir")
        void soldOutItemIsRejected() {
            MenuItem item = burger();
            item.setAvailable(false);
            givenOpenOrder();
            when(menuItemRepository.findByIdAndCompany_Id(7L, COMPANY_ID)).thenReturn(Optional.of(item));

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.addLine(COMPANY_ID, EMAIL, ORDER_ID, 7L, null, null, null, null));

            assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
            assertTrue(ex.getReason() != null && ex.getReason().contains("agotado"));
            verify(lineRepository, never()).save(any());
        }

        @Test
        @DisplayName("repetir un artículo simple acumula cantidad en vez de duplicar la línea")
        void identicalSimpleLineAccumulatesQty() {
            MenuItem item = burger();
            TpvOrderLine existing = line(500L, "9.90", "1", "10.00");
            existing.setMenuItemId(7L);
            existing.setNameSnapshot("Cheeseburger");

            givenOpenOrder();
            when(menuItemRepository.findByIdAndCompany_Id(7L, COMPANY_ID)).thenReturn(Optional.of(item));
            givenLines(existing);
            givenOrderSaveReturnsArgument();

            TpvOrder result = service.addLine(COMPANY_ID, EMAIL, ORDER_ID, 7L, null, null, null, null);

            assertMoney("2", existing.getQty());
            assertMoney("19.80", existing.getLineTotal());
            assertMoney("19.80", result.getTotal());
            // Solo se guarda la línea existente: no se crea una segunda.
            verify(lineRepository, times(1)).save(any(TpvOrderLine.class));
        }

        @Test
        @DisplayName("no se pueden añadir líneas a una comanda ya cobrada")
        void rejectsLinesOnPaidOrder() {
            order.setStatus(TpvOrder.Status.PAID);
            givenOpenOrder();

            ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.addLine(COMPANY_ID, EMAIL, ORDER_ID, 7L, null, null, null, null));

            assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        }
    }

    @Test
    @DisplayName("poner cantidad 0 anula la línea y sus combinados")
    void zeroQtyVoidsLineAndItsModifiers() {
        TpvOrderLine parent = line(500L, "9.90", "1", "10.00");
        TpvOrderLine child = line(501L, "1.50", "1", "10.00");
        child.setParentLineId(500L);

        givenOpenOrder();
        when(lineRepository.findById(500L)).thenReturn(Optional.of(parent));
        when(lineRepository.findByParentLineId(500L)).thenReturn(List.of(child));
        when(lineRepository.findByOrder_IdAndVoidedFalse(ORDER_ID)).thenReturn(List.of());
        givenOrderSaveReturnsArgument();

        TpvOrder result = service.setLineQty(COMPANY_ID, ORDER_ID, 500L, BigDecimal.ZERO);

        assertTrue(parent.isVoided(), "la línea padre debe quedar anulada");
        assertTrue(child.isVoided(), "el combinado debe anularse con su padre");
        assertMoney("0.00", result.getTotal());
    }

    // ─── Multi-tenant ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("una comanda de otra empresa no es accesible")
    void orderFromAnotherCompanyIsNotFound() {
        when(orderRepository.findByIdAndCompany_Id(ORDER_ID, 2L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.getOrder(2L, ORDER_ID));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }
}
