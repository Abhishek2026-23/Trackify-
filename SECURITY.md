# Security Guidelines

## Authentication & Authorization
- JWT tokens with 7-day expiry
- Bcrypt password hashing (10 rounds)
- Phone-based authentication
- Role-based access control (admin, operator, commuter)

## API Security
- Rate limiting: 100 requests/minute per IP
- CORS whitelist configuration
- Helmet.js security headers
- Input validation with Joi
- SQL injection prevention (parameterized queries)

## Data Protection
- Environment variables for secrets
- No sensitive data in logs
- HTTPS in production (TLS 1.3)
- Database connection encryption

## Best Practices
1. Never commit `.env` files
2. Rotate JWT secrets regularly
3. Use strong database passwords
4. Enable PostgreSQL SSL in production
5. Implement API key for GPS devices
6. Monitor for suspicious activity
7. Regular security audits
8. Keep dependencies updated

## Production Checklist
- [ ] Change default passwords
- [ ] Generate strong JWT secret
- [ ] Enable HTTPS
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Enable Redis password
- [ ] Implement API rate limiting
- [ ] Set up monitoring alerts
- [ ] Review CORS origins
- [ ] Enable audit logging
