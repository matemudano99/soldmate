package com.soldmate.tpv;

import com.soldmate.auth.JwtUtil;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/** Catálogo del TPV: categorías y artículos (con escandallo). */
@RestController
@RequestMapping("/api/v1/tpv/menu")
public class MenuController {

    private final MenuService menuService;
    private final JwtUtil jwtUtil;

    public MenuController(MenuService menuService, JwtUtil jwtUtil) {
        this.menuService = menuService;
        this.jwtUtil = jwtUtil;
    }

    public record CategoryResponse(Long id, String name, int sortOrder, String color, boolean active,
                                   boolean isModifierGroup) {
        static CategoryResponse from(MenuCategory c) {
            return new CategoryResponse(c.getId(), c.getName(), c.getSortOrder(), c.getColor(), c.isActive(),
                c.isModifierGroup());
        }
    }

    public record RecipeLineDto(Long productId, BigDecimal quantity) {}

    public record VariantDto(int index, String label, BigDecimal price) {}

    public record ItemResponse(Long id, Long categoryId, String name, BigDecimal price,
                               BigDecimal vatRate, Long sellsAsProductId, boolean active,
                               boolean allowsModifiers, boolean kitchen, boolean available,
                               boolean autoSoldOut, boolean soldOut, List<VariantDto> variants,
                               List<Long> modifierGroupIds, List<RecipeLineDto> recipe) {
        static ItemResponse from(MenuItem i, List<MenuItemIngredient> recipe, boolean soldOut) {
            List<RecipeLineDto> r = recipe.stream()
                .map(x -> new RecipeLineDto(x.getProductId(), x.getQuantity()))
                .toList();
            List<TpvVariants.Variant> parsed = TpvVariants.parse(i.getVariantsJson());
            List<VariantDto> variants = new java.util.ArrayList<>();
            for (int k = 0; k < parsed.size(); k++) {
                variants.add(new VariantDto(k, parsed.get(k).label(), parsed.get(k).price()));
            }
            return new ItemResponse(i.getId(), i.getCategory().getId(), i.getName(), i.getPrice(),
                i.getVatRate(), i.getSellsAsProductId(), i.isActive(), i.isAllowsModifiers(), i.isKitchen(),
                i.isAvailable(), i.isAutoSoldOut(), soldOut, variants,
                TpvVariants.parseLongs(i.getModifierGroupsJson()), r);
        }
    }

    public record CategoryRequest(@NotBlank String name, String color, Integer sortOrder, Boolean isModifierGroup) {}

    public record VariantInput(String label, BigDecimal price) {}

    public record AvailabilityRequest(boolean available) {}

    public record ItemRequest(@NotNull Long categoryId, @NotBlank String name, BigDecimal price,
                              BigDecimal vatRate, Long sellsAsProductId, Boolean allowsModifiers, Boolean kitchen,
                              Boolean autoSoldOut, List<VariantInput> variants, List<Long> modifierGroupIds,
                              List<RecipeLineDto> recipe) {
        String variantsJson() {
            if (variants == null || variants.isEmpty()) return null;
            List<TpvVariants.Variant> vs = variants.stream()
                .filter(v -> v != null && v.label() != null && !v.label().isBlank() && v.price() != null)
                .map(v -> new TpvVariants.Variant(v.label().trim(), v.price()))
                .toList();
            return TpvVariants.toJson(vs);
        }

        String modifierGroupsJson() {
            return TpvVariants.longsToJson(modifierGroupIds);
        }
    }

    // ─── Categorías ───────────────────────────────────────────────────────────

    @GetMapping("/categories")
    @PreAuthorize("isAuthenticated()")
    public List<CategoryResponse> listCategories(@RequestHeader("Authorization") String auth) {
        return menuService.listCategories(companyId(auth)).stream().map(CategoryResponse::from).toList();
    }

    @PostMapping("/categories")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<CategoryResponse> createCategory(@RequestHeader("Authorization") String auth,
                                                           @RequestBody CategoryRequest req) {
        MenuCategory c = menuService.createCategory(companyId(auth), email(auth), req.name(), req.color(),
            req.sortOrder(), req.isModifierGroup());
        return ResponseEntity.status(HttpStatus.CREATED).body(CategoryResponse.from(c));
    }

    @PutMapping("/categories/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public CategoryResponse updateCategory(@RequestHeader("Authorization") String auth, @PathVariable Long id,
                                           @RequestBody CategoryRequest req) {
        MenuCategory c = menuService.updateCategory(companyId(auth), email(auth), id, req.name(), req.color(),
            req.sortOrder(), req.isModifierGroup());
        return CategoryResponse.from(c);
    }

    @DeleteMapping("/categories/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<Void> deleteCategory(@RequestHeader("Authorization") String auth, @PathVariable Long id) {
        menuService.deleteCategory(companyId(auth), email(auth), id);
        return ResponseEntity.noContent().build();
    }

    // ─── Artículos ────────────────────────────────────────────────────────────

    @GetMapping("/items")
    @PreAuthorize("isAuthenticated()")
    public List<ItemResponse> listItems(@RequestHeader("Authorization") String auth,
                                        @RequestParam(required = false) Long categoryId) {
        Long companyId = companyId(auth);
        return menuService.listItems(companyId, categoryId).stream()
            .map(i -> ItemResponse.from(i, menuService.recipeFor(companyId, i.getId()), menuService.isSoldOut(companyId, i)))
            .toList();
    }

    @PostMapping("/items")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<ItemResponse> createItem(@RequestHeader("Authorization") String auth,
                                                   @RequestBody ItemRequest req) {
        Long companyId = companyId(auth);
        MenuItem i = menuService.createItem(companyId, email(auth), req.categoryId(), req.name(),
            req.price(), req.vatRate(), req.sellsAsProductId(), req.allowsModifiers(), req.kitchen(), req.autoSoldOut(),
            req.variantsJson(), req.modifierGroupsJson(), toRecipe(req.recipe()));
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ItemResponse.from(i, menuService.recipeFor(companyId, i.getId()), menuService.isSoldOut(companyId, i)));
    }

    @PutMapping("/items/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ItemResponse updateItem(@RequestHeader("Authorization") String auth,
                                   @PathVariable Long id, @RequestBody ItemRequest req) {
        Long companyId = companyId(auth);
        MenuItem i = menuService.updateItem(companyId, email(auth), id, req.categoryId(), req.name(),
            req.price(), req.vatRate(), req.sellsAsProductId(), req.allowsModifiers(), req.kitchen(), req.autoSoldOut(),
            req.variantsJson(), req.modifierGroupsJson(), toRecipe(req.recipe()));
        return ItemResponse.from(i, menuService.recipeFor(companyId, i.getId()), menuService.isSoldOut(companyId, i));
    }

    @PostMapping("/items/{id}/availability")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR','EMPLOYEE')")
    public ItemResponse setAvailability(@RequestHeader("Authorization") String auth, @PathVariable Long id,
                                        @RequestBody AvailabilityRequest req) {
        Long companyId = companyId(auth);
        MenuItem i = menuService.setAvailable(companyId, email(auth), id, req.available());
        return ItemResponse.from(i, menuService.recipeFor(companyId, i.getId()), menuService.isSoldOut(companyId, i));
    }

    @DeleteMapping("/items/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','SUPERVISOR')")
    public ResponseEntity<Void> deleteItem(@RequestHeader("Authorization") String auth, @PathVariable Long id) {
        menuService.deleteItem(companyId(auth), email(auth), id);
        return ResponseEntity.noContent().build();
    }

    private static List<MenuService.RecipeLine> toRecipe(List<RecipeLineDto> recipe) {
        if (recipe == null) return null;
        return recipe.stream().map(r -> new MenuService.RecipeLine(r.productId(), r.quantity())).toList();
    }

    private Long companyId(String auth) {
        return jwtUtil.extractCompanyId(auth.substring(7));
    }

    private String email(String auth) {
        return jwtUtil.extractEmail(auth.substring(7));
    }
}
