# Security Policy

## Reporting Security Issues

If you discover a security vulnerability in OdinPool, please report it to the maintainers privately. Do not open a public GitHub issue.

## Known Security Considerations

### Critical Security Issues Addressed

1. **Environment Variables Protection**
   - The `.env` file containing sensitive credentials has been removed from version control
   - Always use `.env.example` as a template
   - Never commit actual credentials to git

2. **Database Credentials**
   - Use strong passwords for database access
   - Enable SSL verification in production (`sslmode=require` instead of `no-verify`)
   - Rotate credentials regularly

3. **API Keys**
   - Keep all API keys in environment variables
   - Rotate API keys periodically
   - Use different keys for development and production

### Security Best Practices

#### SSL/TLS Configuration

The application uses HTTPS in production with Let's Encrypt certificates. Ensure:
- Certificates are properly configured at `/etc/letsencrypt/live/odinpool.ai/`
- Certificates are renewed before expiration
- SSL certificate paths are not hardcoded in multiple places

#### CORS Configuration

Current CORS settings allow:
- `https://odinpool.ai`
- `https://www.odinpool.ai`

Review and update CORS origins if deploying to different domains.

#### Database Security

- Use connection pooling to prevent connection exhaustion
- Enable SSL for database connections in production
- Use parameterized queries to prevent SQL injection
- Implement proper error handling to avoid information disclosure

#### Bitcoin RPC Security

- Keep RPC credentials secure
- Use firewall rules to restrict RPC access
- Consider using RPC over SSH tunnel in production
- Monitor RPC access logs

#### Rate Limiting

Consider implementing rate limiting for:
- API endpoints
- WebSocket connections
- Database queries

#### Input Validation

- Validate all user inputs
- Sanitize data before database insertion
- Implement proper error handling
- Avoid exposing stack traces in production

#### Dependency Security

Regularly update dependencies and check for vulnerabilities:

```bash
npm audit
npm audit fix
```

#### Environment-Specific Configuration

- Use different configurations for development and production
- Never use development settings in production
- Implement proper logging (but don't log sensitive data)
- Use environment variables for all configuration

### Production Deployment Checklist

Before deploying to production:

- [ ] All sensitive data is in environment variables
- [ ] `.env` is not committed to version control
- [ ] SSL certificates are properly configured
- [ ] Database SSL verification is enabled
- [ ] CORS settings are properly configured
- [ ] Rate limiting is implemented
- [ ] Error messages don't expose sensitive information
- [ ] All dependencies are up to date
- [ ] Security audit has been performed
- [ ] Backup strategy is in place
- [ ] Monitoring and alerting are configured

### Recommended Security Headers

Consider implementing the following security headers:

```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

### Monitoring and Logging

- Implement proper logging for security events
- Monitor for unusual activity patterns
- Set up alerts for failed authentication attempts
- Keep logs secure and compliant with privacy regulations

## Security Disclosure

We appreciate responsible disclosure of security vulnerabilities. Thank you for helping keep OdinPool and its users safe.
