package com.soldmate.documents;

import com.soldmate.auth.User;
import com.soldmate.company.Company;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Document: metadatos de un fichero subido a Supabase Storage.
 *
 * El binario NO se guarda en Postgres; solo la URL pública de Supabase,
 * el nombre, el tipo MIME, el tamaño en bytes y quién lo subió.
 */
@Entity
@Table(name = "documents")
@Data
@NoArgsConstructor
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre amigable que elige el usuario (puede diferir del nombre del fichero). */
    @Column(nullable = false)
    private String name;

    /** URL pública en Supabase Storage. */
    @Column(name = "file_url", nullable = false, columnDefinition = "TEXT")
    private String fileUrl;

    /** MIME type detectado en el upload: "application/pdf", "image/jpeg", etc. */
    @Column(name = "mime_type")
    private String mimeType;

    /** Tamaño del fichero en bytes. */
    @Column(name = "file_size")
    private Long fileSize;

    /** Extensión normalizada para la UI: PDF, XLSX, IMG, DOCX, etc. */
    @Column(name = "doc_type", length = 20)
    private String docType;

    /** Categoría libre (ej: "Contratos"). Null si no asignada. */
    @Column
    private String category;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Usuario que subió el documento. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_id")
    private User uploadedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;
}
