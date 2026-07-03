package com.soldmate.tpv;

import com.soldmate.activity.ActivityLogger;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import com.soldmate.finance.FinanceTimeZones;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Arqueo de caja: apertura con fondo, movimientos de efectivo y cierre con conteo y descuadre. */
@Service
@Transactional
public class TpvCashService {

    private static final List<TpvOrder.Status> SALE_STATUSES =
        List.of(TpvOrder.Status.PAID, TpvOrder.Status.CLOSED);

    public record MovementDto(Long id, String type, BigDecimal amount, String reason, String createdAt) {
        static MovementDto from(TpvCashMovement m) {
            return new MovementDto(m.getId(), m.getType().name(), m.getAmount(), m.getReason(),
                m.getCreatedAt() != null ? m.getCreatedAt().toString() : null);
        }
    }

    /** Estado de la caja: si hay sesión abierta, con su fondo, ventas en efectivo, movimientos y esperado. */
    public record CashState(boolean open, Long sessionId, String businessDay, String openedBy, String openedAt,
                            BigDecimal openingFloat, BigDecimal cashSales, BigDecimal movementsIn,
                            BigDecimal movementsOut, BigDecimal expectedCash, List<MovementDto> movements) {}

    /** Resultado del arqueo al cerrar: esperado, contado y descuadre. */
    public record CloseResult(Long sessionId, String businessDay, BigDecimal openingFloat, BigDecimal cashSales,
                              BigDecimal movementsIn, BigDecimal movementsOut, BigDecimal expectedCash,
                              BigDecimal countedCash, BigDecimal difference) {}

    private final TpvCashSessionRepository sessionRepository;
    private final TpvCashMovementRepository movementRepository;
    private final TpvPaymentRepository paymentRepository;
    private final CompanyRepository companyRepository;
    private final ActivityLogger activityLogger;

    public TpvCashService(TpvCashSessionRepository sessionRepository,
                          TpvCashMovementRepository movementRepository,
                          TpvPaymentRepository paymentRepository,
                          CompanyRepository companyRepository,
                          ActivityLogger activityLogger) {
        this.sessionRepository = sessionRepository;
        this.movementRepository = movementRepository;
        this.paymentRepository = paymentRepository;
        this.companyRepository = companyRepository;
        this.activityLogger = activityLogger;
    }

    @Transactional(readOnly = true)
    public CashState current(Long companyId) {
        TpvCashSession s = openSession(companyId).orElse(null);
        if (s == null) {
            return new CashState(false, null, null, null, null, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, List.of());
        }
        return state(companyId, s);
    }

    public CashState open(Long companyId, String email, BigDecimal openingFloat) {
        if (openSession(companyId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya hay una caja abierta");
        }
        Company company = company(companyId);
        TpvCashSession s = new TpvCashSession();
        s.setCompany(company);
        s.setBusinessDay(LocalDate.now(FinanceTimeZones.resolveZoneId(company.getTimezone())));
        s.setStatus(TpvCashSession.Status.OPEN);
        s.setOpeningFloat(scale(openingFloat));
        s.setOpenedBy(email);
        s.setOpenedAt(Instant.now());
        s = sessionRepository.save(s);
        activityLogger.log(companyId, email, "TPV_CASH", "APERTURA", "Fondo " + s.getOpeningFloat() + "€");
        return state(companyId, s);
    }

    public CashState addMovement(Long companyId, String email, String type, BigDecimal amount, String reason) {
        TpvCashSession s = requireOpen(companyId);
        TpvCashMovement.Type t;
        try {
            t = TpvCashMovement.Type.valueOf(type != null ? type.trim().toUpperCase() : "OUT");
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de movimiento inválido");
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Importe inválido");
        }
        TpvCashMovement m = new TpvCashMovement();
        m.setCompany(s.getCompany());
        m.setSession(s);
        m.setType(t);
        m.setAmount(scale(amount));
        m.setReason(reason != null && !reason.isBlank() ? reason.trim() : null);
        m.setCreatedBy(email);
        movementRepository.save(m);
        activityLogger.log(companyId, email, "TPV_CASH", t == TpvCashMovement.Type.IN ? "ENTRADA" : "SALIDA",
            m.getAmount() + "€" + (m.getReason() != null ? " · " + m.getReason() : ""));
        return state(companyId, s);
    }

    public CloseResult close(Long companyId, String email, BigDecimal countedCash, String note) {
        TpvCashSession s = requireOpen(companyId);
        CashState st = state(companyId, s);
        BigDecimal expected = st.expectedCash();
        BigDecimal counted = scale(countedCash != null ? countedCash : BigDecimal.ZERO);
        BigDecimal diff = counted.subtract(expected).setScale(2, RoundingMode.HALF_UP);
        s.setExpectedCash(expected);
        s.setCountedCash(counted);
        s.setDifference(diff);
        s.setNote(note != null && !note.isBlank() ? note.trim() : null);
        s.setStatus(TpvCashSession.Status.CLOSED);
        s.setClosedAt(Instant.now());
        s.setClosedBy(email);
        sessionRepository.save(s);
        activityLogger.log(companyId, email, "TPV_CASH", "CIERRE",
            "Contado " + counted + "€ · esperado " + expected + "€ · descuadre " + diff + "€");
        return new CloseResult(s.getId(), s.getBusinessDay().toString(), s.getOpeningFloat(), st.cashSales(),
            st.movementsIn(), st.movementsOut(), expected, counted, diff);
    }

    // ─── Internos ───────────────────────────────────────────────────────────────

    private CashState state(Long companyId, TpvCashSession s) {
        List<TpvCashMovement> movements = movementRepository.findBySession_IdOrderByIdAsc(s.getId());
        BigDecimal in = movements.stream().filter(m -> m.getType() == TpvCashMovement.Type.IN)
            .map(TpvCashMovement::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal out = movements.stream().filter(m -> m.getType() == TpvCashMovement.Type.OUT)
            .map(TpvCashMovement::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cashSales = cashSales(companyId, s.getBusinessDay());
        BigDecimal expected = s.getOpeningFloat().add(cashSales).add(in).subtract(out).setScale(2, RoundingMode.HALF_UP);
        return new CashState(true, s.getId(), s.getBusinessDay().toString(), s.getOpenedBy(),
            s.getOpenedAt() != null ? s.getOpenedAt().toString() : null, s.getOpeningFloat(), cashSales,
            in.setScale(2, RoundingMode.HALF_UP), out.setScale(2, RoundingMode.HALF_UP), expected,
            movements.stream().map(MovementDto::from).toList());
    }

    private BigDecimal cashSales(Long companyId, LocalDate day) {
        return paymentRepository.findForBusinessDay(companyId, day, SALE_STATUSES).stream()
            .filter(p -> p.getMethod() == TpvPayment.Method.CASH)
            .map(TpvPayment::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);
    }

    private java.util.Optional<TpvCashSession> openSession(Long companyId) {
        return sessionRepository.findFirstByCompany_IdAndStatusOrderByOpenedAtDesc(companyId, TpvCashSession.Status.OPEN);
    }

    private TpvCashSession requireOpen(Long companyId) {
        return openSession(companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "No hay ninguna caja abierta"));
    }

    private static BigDecimal scale(BigDecimal v) {
        return (v != null ? v : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private Company company(Long companyId) {
        return companyRepository.findById(companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));
    }
}
