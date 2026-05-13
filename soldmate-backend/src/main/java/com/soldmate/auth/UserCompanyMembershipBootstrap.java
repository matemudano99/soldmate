package com.soldmate.auth;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Crea una fila de membresía por cada usuario existente que solo tenía {@code users.company_id}.
 */
@Component
@Order(5_000)
public class UserCompanyMembershipBootstrap implements ApplicationRunner {

    private final UserRepository userRepository;
    private final UserCompanyMembershipRepository membershipRepository;

    public UserCompanyMembershipBootstrap(
        UserRepository userRepository,
        UserCompanyMembershipRepository membershipRepository
    ) {
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (User user : userRepository.findAll()) {
            if (user.getCompany() == null || user.getCompany().getId() == null) {
                continue;
            }
            if (!membershipRepository.existsByUser_IdAndCompany_Id(user.getId(), user.getCompany().getId())) {
                membershipRepository.save(UserCompanyMembership.of(user, user.getCompany(), user.getRole()));
            }
        }
    }
}
