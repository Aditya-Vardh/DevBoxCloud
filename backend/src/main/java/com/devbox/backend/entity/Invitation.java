package com.devbox.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Shareable invitation link for a workspace environment.
 * Once created, the link can be shared with others who can redeem it to gain
 * read-only access to the environment's terminal and desktop URLs.
 */
@Entity
@Table(name = "invitations",
       indexes = {
           @Index(name = "idx_invitation_code",    columnList = "code",          unique = true),
           @Index(name = "idx_invitation_env_id",  columnList = "environment_id"),
       })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Invitation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    /** The environment this invitation provides access to. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "environment_id", nullable = false)
    @org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.CASCADE)
    private Environment environment;

    /**
     * Cryptographically random token sent in the share URL.
     * URL-safe, 32 hex characters (128 bits of entropy).
     */
    @Column(name = "code", nullable = false, length = 64, unique = true)
    private String code;

    /** Optional: maximum number of redemptions (null = unlimited). */
    @Column(name = "max_uses")
    private Integer maxUses;

    /** Number of times the invitation has been successfully redeemed. */
    @Column(name = "use_count", nullable = false)
    @Builder.Default
    private int useCount = 0;

    /** Whether the owner has manually revoked this invitation. */
    @Column(name = "revoked", nullable = false)
    @Builder.Default
    private boolean revoked = false;

    /** Optional expiry date-time. Null = does not expire. */
    @Column(name = "expires_at")
    private Instant expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** True if the invitation is still usable right now. */
    public boolean isValid() {
        if (revoked) return false;
        if (expiresAt != null && Instant.now().isAfter(expiresAt)) return false;
        if (maxUses != null && useCount >= maxUses) return false;
        return true;
    }
}
