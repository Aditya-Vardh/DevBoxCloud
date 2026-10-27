package com.devbox.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class CreateInvitationRequest {

    /** Hours until the invitation expires. Null = no expiry. */
    @Min(1) @Max(8760)
    private Integer expiresInHours;

    /** Maximum number of times the invitation can be redeemed. Null = unlimited. */
    @Min(1) @Max(100)
    private Integer maxUses;
}
