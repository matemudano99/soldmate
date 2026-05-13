package com.soldmate.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserCompanyMembershipRepository extends JpaRepository<UserCompanyMembership, Long> {

    List<UserCompanyMembership> findByCompany_IdOrderByUser_FirstNameAscUser_LastNameAsc(Long companyId);

    Optional<UserCompanyMembership> findByUser_IdAndCompany_Id(Long userId, Long companyId);

    boolean existsByUser_IdAndCompany_Id(Long userId, Long companyId);

    long countByUser_Id(Long userId);

    List<UserCompanyMembership> findByUser_IdOrderByCompany_NameAsc(Long userId);
}
