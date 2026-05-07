package com.soldmate.notifications;

import com.soldmate.company.Company;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(nullable = false)
    private String type;    // INFO | WARNING | ALERT

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String body;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Notification() {}

    public Notification(Company company, String type, String title, String body) {
        this.company = company;
        this.type = type;
        this.title = title;
        this.body = body;
    }

    public Long getId() { return id; }
    public Company getCompany() { return company; }
    public String getType() { return type; }
    public String getTitle() { return title; }
    public String getBody() { return body; }
    public LocalDateTime getReadAt() { return readAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public boolean isRead() { return readAt != null; }

    public void markRead() { this.readAt = LocalDateTime.now(); }

    public void setCompany(Company company) { this.company = company; }
    public void setType(String type) { this.type = type; }
    public void setTitle(String title) { this.title = title; }
    public void setBody(String body) { this.body = body; }
    public void setReadAt(LocalDateTime readAt) { this.readAt = readAt; }
}
