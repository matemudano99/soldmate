package com.soldmate.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface UserCompanyMembershipRepository extends JpaRepository<UserCompanyMembership, Long> {

    @Query("""
        SELECT m FROM UserCompanyMembership m
        JOIN FETCH m.user u
        JOIN FETCH m.company c
        ORDER BY c.name ASC, u.email ASC
        """)
    List<UserCompanyMembership> findAllWithUserAndCompanyOrderByCompanyAndEmail();

    List<UserCompanyMembership> findByCompany_IdOrderByUser_FirstNameAscUser_LastNameAsc(Long companyId);

    Optional<UserCompanyMembership> findByUser_IdAndCompany_Id(Long userId, Long companyId);

    boolean existsByUser_IdAndCompany_Id(Long userId, Long companyId);

    long countByUser_Id(Long userId);

    List<UserCompanyMembership> findByUser_IdOrderByCompany_NameAsc(Long userId);
}
