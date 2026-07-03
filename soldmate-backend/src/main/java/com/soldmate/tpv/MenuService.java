package com.soldmate.tpv;

import com.soldmate.activity.ActivityLogger;
import com.soldmate.company.Company;
import com.soldmate.company.CompanyRepository;
import com.soldmate.inventory.ProductRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

/** Gestión del catálogo del TPV: categorías, artículos y escandallo. */
@Service
@Transactional
public class MenuService {

    public record RecipeLine(Long productId, BigDecimal quantity) {}

    private final MenuCategoryRepository categoryRepository;
    private final MenuItemRepository itemRepository;
    private final MenuItemIngredientRepository ingredientRepository;
    private final ProductRepository productRepository;
    private final CompanyRepository companyRepository;
    private final ActivityLogger activityLogger;

    public MenuService(MenuCategoryRepository categoryRepository,
                       MenuItemRepository itemRepository,
                       MenuItemIngredientRepository ingredientRepository,
                       ProductRepository productRepository,
                       CompanyRepository companyRepository,
                       ActivityLogger activityLogger) {
        this.categoryRepository = categoryRepository;
        this.itemRepository = itemRepository;
        this.ingredientRepository = ingredientRepository;
        this.productRepository = productRepository;
        this.companyRepository = companyRepository;
        this.activityLogger = activityLogger;
    }

    // ─── Disponibilidad (agotado) ───────────────────────────────────────────────

    /** Marca un artículo como disponible o agotado (operación rápida del día). */
    public MenuItem setAvailable(Long companyId, String email, Long itemId, boolean available) {
        MenuItem item = itemRepository.findByIdAndCompany_Id(itemId, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artículo no encontrado"));
        item.setAvailable(available);
        item = itemRepository.save(item);
        activityLogger.log(companyId, email, "TPV_MENU_ITEM", available ? "DISPONIBLE" : "AGOTADO", item.getName());
        return item;
    }

    /** Agotado efectivo: marcado manualmente como no disponible, o auto-agotado por stock a 0. */
    @Transactional(readOnly = true)
    public boolean isSoldOut(Long companyId, MenuItem item) {
        if (!item.isAvailable()) return true;
        return item.isAutoSoldOut() && isStockOut(companyId, item);
    }

    private boolean isStockOut(Long companyId, MenuItem item) {
        List<MenuItemIngredient> recipe = ingredientRepository.findByMenuItem_IdAndCompany_Id(item.getId(), companyId);
        if (!recipe.isEmpty()) {
            for (MenuItemIngredient ing : recipe) {
                boolean out = productRepository.findByIdAndCompanyId(ing.getProductId(), companyId)
                    .map(p -> p.getCurrentStock().compareTo(BigDecimal.ZERO) <= 0)
                    .orElse(false);
                if (out) return true;
            }
            return false;
        }
        if (item.getSellsAsProductId() != null) {
            return productRepository.findByIdAndCompanyId(item.getSellsAsProductId(), companyId)
                .map(p -> p.getCurrentStock().compareTo(BigDecimal.ZERO) <= 0)
                .orElse(false);
        }
        return false;
    }

    // ─── Categorías ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<MenuCategory> listCategories(Long companyId) {
        return categoryRepository.findByCompany_IdOrderBySortOrderAscNameAsc(companyId);
    }

    public MenuCategory createCategory(Long companyId, String email, String name, String color,
                                       Integer sortOrder, Boolean modifierGroup) {
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre de categoría obligatorio");
        }
        if (categoryRepository.existsByCompany_IdAndNameIgnoreCase(companyId, name.trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una categoría con ese nombre");
        }
        Company company = company(companyId);
        MenuCategory c = new MenuCategory();
        c.setCompany(company);
        c.setName(name.trim());
        c.setColor(color);
        c.setSortOrder(sortOrder != null ? sortOrder : 0);
        c.setModifierGroup(Boolean.TRUE.equals(modifierGroup));
        c = categoryRepository.save(c);
        activityLogger.log(companyId, email, "TPV_MENU_CATEGORY", "CREADO", c.getName());
        return c;
    }

    // ─── Artículos ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<MenuItem> listItems(Long companyId, Long categoryId) {
        return categoryId != null
            ? itemRepository.findByCompany_IdAndCategory_IdOrderBySortOrderAscNameAsc(companyId, categoryId)
            : itemRepository.findByCompany_IdOrderBySortOrderAscNameAsc(companyId);
    }

    @Transactional(readOnly = true)
    public List<MenuItemIngredient> recipeFor(Long companyId, Long itemId) {
        return ingredientRepository.findByMenuItem_IdAndCompany_Id(itemId, companyId);
    }

    // ─── Categorías: editar / borrar ────────────────────────────────────────────

    public MenuCategory updateCategory(Long companyId, String email, Long categoryId, String name,
                                       String color, Integer sortOrder, Boolean modifierGroup) {
        MenuCategory c = categoryRepository.findByIdAndCompany_Id(categoryId, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoría no encontrada"));
        if (name != null && !name.isBlank()) c.setName(name.trim());
        if (color != null) c.setColor(color.isBlank() ? null : color);
        if (sortOrder != null) c.setSortOrder(sortOrder);
        if (modifierGroup != null) c.setModifierGroup(modifierGroup);
        c = categoryRepository.save(c);
        activityLogger.log(companyId, email, "TPV_MENU_CATEGORY", "MODIFICADO", c.getName());
        return c;
    }

    public void deleteCategory(Long companyId, String email, Long categoryId) {
        MenuCategory c = categoryRepository.findByIdAndCompany_Id(categoryId, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoría no encontrada"));
        // Borra los artículos de la categoría (y su escandallo) antes de la categoría.
        for (MenuItem item : itemRepository.findByCompany_IdAndCategory_IdOrderBySortOrderAscNameAsc(companyId, categoryId)) {
            ingredientRepository.deleteByMenuItem_IdAndCompany_Id(item.getId(), companyId);
            itemRepository.delete(item);
        }
        String name = c.getName();
        categoryRepository.delete(c);
        activityLogger.log(companyId, email, "TPV_MENU_CATEGORY", "ELIMINADO", name);
    }

    // ─── Artículos ────────────────────────────────────────────────────────────

    public MenuItem createItem(Long companyId, String email, Long categoryId, String name,
                               BigDecimal price, BigDecimal vatRate, Long sellsAsProductId,
                               Boolean allowsModifiers, Boolean kitchen, Boolean autoSoldOut,
                               String variantsJson, String modifierGroupsJson, List<RecipeLine> recipe) {
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre del artículo obligatorio");
        }
        MenuCategory category = categoryRepository.findByIdAndCompany_Id(categoryId, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Categoría no encontrada"));
        Company company = company(companyId);

        MenuItem item = new MenuItem();
        item.setCompany(company);
        item.setCategory(category);
        item.setName(name.trim());
        item.setPrice(price != null ? price : BigDecimal.ZERO);
        item.setVatRate(vatRate != null ? vatRate : new BigDecimal("10.00"));
        item.setSellsAsProductId(sellsAsProductId);
        item.setAllowsModifiers(Boolean.TRUE.equals(allowsModifiers));
        item.setKitchen(Boolean.TRUE.equals(kitchen));
        item.setAutoSoldOut(Boolean.TRUE.equals(autoSoldOut));
        item.setVariantsJson(variantsJson);
        item.setModifierGroupsJson(modifierGroupsJson);
        item = itemRepository.save(item);

        saveRecipe(companyId, company, item, recipe);

        activityLogger.log(companyId, email, "TPV_MENU_ITEM", "CREADO", item.getName());
        return item;
    }

    public MenuItem updateItem(Long companyId, String email, Long itemId, Long categoryId, String name,
                               BigDecimal price, BigDecimal vatRate, Long sellsAsProductId,
                               Boolean allowsModifiers, Boolean kitchen, Boolean autoSoldOut,
                               String variantsJson, String modifierGroupsJson, List<RecipeLine> recipe) {
        MenuItem item = itemRepository.findByIdAndCompany_Id(itemId, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artículo no encontrado"));
        if (categoryId != null) {
            MenuCategory category = categoryRepository.findByIdAndCompany_Id(categoryId, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Categoría no encontrada"));
            item.setCategory(category);
        }
        if (name != null && !name.isBlank()) item.setName(name.trim());
        if (price != null) item.setPrice(price);
        if (vatRate != null) item.setVatRate(vatRate);
        if (allowsModifiers != null) item.setAllowsModifiers(allowsModifiers);
        if (kitchen != null) item.setKitchen(kitchen);
        if (autoSoldOut != null) item.setAutoSoldOut(autoSoldOut);
        item.setSellsAsProductId(sellsAsProductId);
        item.setVariantsJson(variantsJson);
        item.setModifierGroupsJson(modifierGroupsJson);
        item = itemRepository.save(item);

        if (recipe != null) {
            ingredientRepository.deleteByMenuItem_IdAndCompany_Id(itemId, companyId);
            saveRecipe(companyId, item.getCompany(), item, recipe);
        }
        activityLogger.log(companyId, email, "TPV_MENU_ITEM", "MODIFICADO", item.getName());
        return item;
    }

    public void deleteItem(Long companyId, String email, Long itemId) {
        MenuItem item = itemRepository.findByIdAndCompany_Id(itemId, companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Artículo no encontrado"));
        ingredientRepository.deleteByMenuItem_IdAndCompany_Id(itemId, companyId);
        String name = item.getName();
        itemRepository.delete(item);
        activityLogger.log(companyId, email, "TPV_MENU_ITEM", "ELIMINADO", name);
    }

    private void saveRecipe(Long companyId, Company company, MenuItem item, List<RecipeLine> recipe) {
        if (recipe == null) return;
        for (RecipeLine line : recipe) {
            if (line == null || line.productId() == null || line.quantity() == null
                || line.quantity().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            MenuItemIngredient ing = new MenuItemIngredient();
            ing.setCompany(company);
            ing.setMenuItem(item);
            ing.setProductId(line.productId());
            ing.setQuantity(line.quantity());
            ingredientRepository.save(ing);
        }
    }

    private Company company(Long companyId) {
        return companyRepository.findById(companyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Empresa no encontrada"));
    }
}
