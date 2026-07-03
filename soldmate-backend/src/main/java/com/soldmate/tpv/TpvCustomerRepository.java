package com.soldmate.tpv;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TpvCustomerRepository extends JpaRepository<TpvCustomer, Long> {

    List<TpvCustomer> findByCompany_IdOrderByNameAsc(Long companyId);

    Optional<TpvCustomer> findByIdAndCompany_Id(Long id, Long companyId);

    Optional<TpvCustomer> findFirstByCompany_IdAndPhone(Long companyId, String phone);

    List<TpvCustomer> findTop10ByCompany_IdAndNameContainingIgnoreCaseOrderByNameAsc(Long companyId, String name);

    List<TpvCustomer> findTop10ByCompany_IdAndPhoneContainingOrderByNameAsc(Long companyId, String phone);
}
