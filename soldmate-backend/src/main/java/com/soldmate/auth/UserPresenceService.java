package com.soldmate.auth;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Actualiza {@code users.last_seen_at} con throttling por email (evita escribir en cada request).
 */
@Service
public class UserPresenceService {

    private static final Duration THROTTLE = Duration.ofSeconds(30);

    private final UserRepository userRepository;
    private final ConcurrentHashMap<String, Instant> lastTouchByEmail = new ConcurrentHashMap<>();

    public UserPresenceService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public Instant touchNow(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        String key = email.trim().toLowerCase();
        Instant seen = Instant.now();
        lastTouchByEmail.put(key, seen);
        User user = userRepository.findByEmail(key).orElse(null);
        if (user == null) {
            return null;
        }
        user.setLastSeenAt(seen);
        userRepository.save(user);
        return seen;
    }

    @Transactional
    public Instant touchIfNeeded(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        String key = email.trim().toLowerCase();
        Instant now = Instant.now();
        Instant prev = lastTouchByEmail.get(key);
        if (prev != null && Duration.between(prev, now).compareTo(THROTTLE) < 0) {
            return userRepository.findByEmail(key).map(User::getLastSeenAt).orElse(null);
        }
        lastTouchByEmail.put(key, now);
        User user = userRepository.findByEmail(key).orElse(null);
        if (user == null) {
            return null;
        }
        user.setLastSeenAt(now);
        userRepository.save(user);
        return now;
    }
}
