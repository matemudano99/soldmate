package com.soldmate.tpv;

import com.soldmate.inventory.Product;
import com.soldmate.inventory.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

/**
 * Descuenta stock de inventario al cobrar una comanda, según el escandallo de cada artículo
 * ({@link MenuItemIngredient}) o, si no hay receta, por {@code sellsAsProductId}.
 *
 * Regla de negocio: una venta NUNCA se bloquea por falta de stock. Se permite stock negativo y las
 * alertas de inventario existentes reflejarán la rotura. Se ejecuta dentro de la transacción del pago.
 */
@Service
public class StockDeductionService {

    private static final Logger log = LoggerFactory.getLogger(StockDeductionService.class);

    private final MenuItemRepository menuItemRepository;
    private final MenuItemIngredientRepository ingredientRepository;
    private final ProductRepository productRepository;

    public StockDeductionService(MenuItemRepository menuItemRepository,
                                 MenuItemIngredientRepository ingredientRepository,
                                 ProductRepository productRepository) {
        this.menuItemRepository = menuItemRepository;
        this.ingredientRepository = ingredientRepository;
        this.productRepository = productRepository;
    }

    public void deductForOrder(Long companyId, List<TpvOrderLine> lines) {
        for (TpvOrderLine line : lines) {
            if (line.isVoided() || line.getMenuItemId() == null) {
                continue;
            }
            MenuItem item = menuItemRepository.findByIdAndCompany_Id(line.getMenuItemId(), companyId).orElse(null);
            if (item == null) {
                continue;
            }
            List<MenuItemIngredient> recipe = ingredientRepository.findByMenuItem_IdAndCompany_Id(item.getId(), companyId);
            if (!recipe.isEmpty()) {
                for (MenuItemIngredient ing : recipe) {
                    BigDecimal consumed = ing.getQuantity().multiply(line.getQty());
                    decrement(companyId, ing.getProductId(), consumed);
                }
            } else if (item.getSellsAsProductId() != null) {
                decrement(companyId, item.getSellsAsProductId(), line.getQty());
            }
            // Si no hay receta ni producto vinculado, el artículo no descuenta stock (intencional).
        }
    }

    private void decrement(Long companyId, Long productId, BigDecimal amount) {
        Product product = productRepository.findByIdAndCompanyId(productId, companyId).orElse(null);
        if (product == null) {
            log.warn("Descuento de stock omitido: producto {} no existe en empresa {}", productId, companyId);
            return;
        }
        product.setCurrentStock(product.getCurrentStock().subtract(amount));
        productRepository.save(product);
    }
}
