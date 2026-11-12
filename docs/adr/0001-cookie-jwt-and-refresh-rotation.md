# Cookie JWT and rotating refresh sessions

The browser authenticates with an `httpOnly` stateless access JWT and an opaque rotating refresh token rather than browser-readable tokens or a database lookup on every request. Refresh tokens are stored only as keyed HMAC values, each login creates an independent token family, and reuse of a replaced token revokes its entire family; this keeps ordinary API reads stateless while containing replay of longer-lived credentials.
