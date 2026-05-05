package com.soldmate.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    List<User> findByCompanyIdOrderByFirstNameAsc(Long companyId);
    Optional<User> findByIdAndCompanyId(Long id, Long companyId);
}
