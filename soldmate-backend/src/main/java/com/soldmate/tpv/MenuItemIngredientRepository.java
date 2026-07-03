package com.soldmate.tpv;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MenuItemIngredientRepository extends JpaRepository<MenuItemIngredient, Long> {

    List<MenuItemIngredient> findByMenuItem_IdAndCompany_Id(Long menuItemId, Long companyId);

    void deleteByMenuItem_IdAndCompany_Id(Long menuItemId, Long companyId);
}
