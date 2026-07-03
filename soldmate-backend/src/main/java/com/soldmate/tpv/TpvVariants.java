package com.soldmate.tpv;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.List;

/** Utilidad para (de)serializar las variantes de tamaño de un artículo guardadas como JSON. */
public final class TpvVariants {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public record Variant(String label, BigDecimal price) {}

    private TpvVariants() {}

    public static List<Variant> parse(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<Variant> list = MAPPER.readValue(json, new TypeReference<List<Variant>>() {});
            return list != null ? list : List.of();
        } catch (Exception e) {
            return List.of();
        }
    }

    public static String toJson(List<Variant> variants) {
        if (variants == null || variants.isEmpty()) return null;
        try {
            return MAPPER.writeValueAsString(variants);
        } catch (Exception e) {
            return null;
        }
    }

    /** Lista de ids (p. ej. grupos de combinados) desde JSON; vacía si null/ilegible. */
    public static List<Long> parseLongs(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<Long> list = MAPPER.readValue(json, new TypeReference<List<Long>>() {});
            return list != null ? list : List.of();
        } catch (Exception e) {
            return List.of();
        }
    }

    public static String longsToJson(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return null;
        try {
            return MAPPER.writeValueAsString(ids);
        } catch (Exception e) {
            return null;
        }
    }
}
