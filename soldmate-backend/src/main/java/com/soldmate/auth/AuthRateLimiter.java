package com.soldmate.auth;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limiter en memoria para endpoints de autenticación.
 * Diseño simple para MVP productivo:
 * - login: 10 req / 5 min por IP
 * - register: 5 req / 10 min por IP
 */
@Component
public class AuthRateLimiter {

    private record WindowState(int count, long windowStartEpochSec) {}

    private final Map<String, WindowState> loginWindows = new ConcurrentHashMap<>();
    private final Map<String, WindowState> registerWindows = new ConcurrentHashMap<>();

    public boolean allowLogin(String ipKey) {
        return allow(loginWindows, "login:" + ipKey, 10, 300);
    }

    public boolean allowRegister(String ipKey) {
        return allow(registerWindows, "register:" + ipKey, 5, 600);
    }

    private boolean allow(Map<String, WindowState> map, String key, int maxRequests, int windowSec) {
        long now = Instant.now().getEpochSecond();
        WindowState state = map.get(key);
        if (state == null || (now - state.windowStartEpochSec()) > windowSec) {
            map.put(key, new WindowState(1, now));
            return true;
        }
        if (state.count() >= maxRequests) {
            return false;
        }
        map.put(key, new WindowState(state.count() + 1, state.windowStartEpochSec()));
        return true;
    }
}

