package com.soldmate.auth;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Vincula un usuario con un negocio ({@link Company}) y su rol en ese negocio.
 * Un mismo email puede operar en varios negocios (cada uno con datos aislados por {@code company_id}).
 */
@Entity
@Table(
    name = "user_company_memberships",
    uniqueConstraints = @UniqueConstraint(name = "uk_user_company", columnNames = {"user_id", "company_id"})
)
@Data
@NoArgsConstructor
public class UserCompanyMembership {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private User.Role role = User.Role.EMPLOYEE;

    public static UserCompanyMembership of(User user, Company company, User.Role role) {
        UserCompanyMembership m = new UserCompanyMembership();
        m.setUser(user);
        m.setCompany(company);
        m.setRole(role);
        return m;
    }
}
