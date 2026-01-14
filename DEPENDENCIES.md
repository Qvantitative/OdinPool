# Dependency Vulnerabilities Report

**Generated:** 2026-01-14  
**Project:** OdinPool

## Summary

- **Total Vulnerabilities:** 38
  - Critical: 8
  - High: 20
  - Moderate: 7
  - Low: 3

## Recommended Actions

### 1. Safe Fixes (Non-Breaking Changes)

Run the following command to fix vulnerabilities that don't require breaking changes:

```bash
npm audit fix
```

This will address vulnerabilities in:
- `undici`
- Various transitive dependencies

### 2. Breaking Changes Required

Some vulnerabilities require major version updates. Review these carefully before updating:

#### axios (HIGH PRIORITY - Critical/High Severity)

**Current:** 1.7.7  
**Issues:**
- Cross-Site Request Forgery (CSRF) vulnerability
- DoS attack through lack of data size check
- SSRF and credential leakage via absolute URL

**Recommended Action:**
```bash
npm install axios@latest
```
This should be safe as axios 1.x is already installed. Update to the latest 1.x version.

#### ws (High Severity)

**Current:** 8.18.0 (appears to be recent)  
**Issues:**
- DoS when handling requests with many HTTP headers

**Recommended Action:**
```bash
npm update ws
```

#### @mempool/mempool.js (High Severity - via axios and ws)

**Current:** 2.3.0  
**Latest:** 3.0.0 (breaking change)

**Recommended Action:**
Review changelog at https://github.com/mempool/mempool.js before updating:
```bash
npm install @mempool/mempool.js@latest
```

Test thoroughly after this update.

#### valibot (High Severity)

**Current:** Various versions (0.31.0 - 1.1.0)  
**Issue:** ReDoS vulnerability in EMOJI_REGEX

**Affects:**
- bip32
- bitcoinjs-lib
- ecpair
- @sats-connect/core

**Recommended Action:**
This is a transitive dependency. Consider:
1. Update parent packages if newer versions use patched valibot
2. Or use `npm audit fix --force` (review breaking changes first)

#### sats-connect (via @sats-connect/core)

**Current:** 2.8.x  
**Latest:** 4.2.1 (breaking change)

**Recommended Action:**
Major version update required. Review:
1. Migration guide
2. API changes
3. Test wallet integration after update

```bash
npm install sats-connect@latest
```

### 3. No Fix Available

#### bitcoin-core (via @uphold/request-logger > request)

**Issue:** Uses deprecated `request` package  
**Status:** No fix available

**Recommended Action:**
- Monitor for bitcoin-core updates
- Consider alternative Bitcoin RPC clients if security is critical
- Or maintain current version with awareness of the issue

#### tough-cookie

**Issue:** Prototype pollution vulnerability  
**Status:** No fix available (< 4.1.3)

**Recommended Action:**
- Likely a transitive dependency
- Monitor for updates to parent packages

## Detailed Vulnerability List

### Critical (8)

1. **axios** - SSRF and credential leakage
2. **axios** - Multiple DoS vulnerabilities
3. Various transitive dependencies

### High (20)

1. **axios** - CSRF vulnerability
2. **ws** - DoS via many HTTP headers
3. **valibot** - ReDoS in EMOJI_REGEX
4. **@mempool/mempool.js** - Via axios and ws
5. **@sats-connect/core** - Via axios and valibot
6. **glob** - Unspecified
7. Various transitive dependencies

### Moderate (7)

1. **@babel/runtime** - Inefficient RegExp complexity
2. **@uphold/request-logger** - Via deprecated request package
3. **undici** - Insufficiently random values & DoS
4. **tough-cookie** - Prototype pollution
5. Various transitive dependencies

### Low (3)

Various transitive dependencies

## Step-by-Step Update Plan

### Phase 1: Safe Updates (Do First)

```bash
# Update packages with non-breaking fixes
npm audit fix

# Update specific packages to latest patch/minor versions
npm update undici
npm update ws
```

### Phase 2: Review and Test (Do Second)

```bash
# Update axios to latest 1.x
npm install axios@latest

# Test the application thoroughly
npm run dev
```

### Phase 3: Breaking Changes (Do After Testing)

**Before running these, review changelogs and test thoroughly:**

```bash
# Update mempool.js (major version change)
npm install @mempool/mempool.js@latest

# Update sats-connect (major version change)
npm install sats-connect@latest

# Test wallet functionality
# Test blockchain data fetching
# Test all integrations
```

### Phase 4: Transitive Dependencies

```bash
# Force update with breaking changes (use with caution)
npm audit fix --force

# Review what changed
git diff package.json package-lock.json

# Test thoroughly
npm run dev
npm run build
```

## Testing Checklist After Updates

- [ ] Application starts without errors
- [ ] Bitcoin RPC connection works
- [ ] Database queries execute correctly
- [ ] Mempool API integration works
- [ ] Wallet connection (Xverse) functions
- [ ] Real-time WebSocket updates work
- [ ] All API endpoints respond correctly
- [ ] Frontend renders without errors
- [ ] Charts and visualizations display
- [ ] No console errors in browser

## Monitoring

After updates, monitor for:
- Runtime errors
- Performance degradation
- API failures
- WebSocket connection issues
- Database connection problems

## Prevention

To prevent future vulnerabilities:

1. **Enable Dependabot** (if using GitHub):
   - Automatic dependency update PRs
   - Security vulnerability alerts

2. **Regular Updates:**
   ```bash
   # Weekly or monthly
   npm outdated
   npm audit
   ```

3. **Lock File:**
   - Keep `package-lock.json` in version control
   - Ensures consistent dependency versions

4. **CI/CD Integration:**
   - Add `npm audit` to CI pipeline
   - Fail builds on high/critical vulnerabilities

5. **Dependency Review:**
   - Before adding new dependencies, check:
     - Last update date
     - Number of weekly downloads
     - GitHub stars/activity
     - Known vulnerabilities

## Additional Notes

- The `request` package used by `bitcoin-core` is deprecated
- Consider evaluating alternative Bitcoin RPC clients in the future
- Some vulnerabilities are in development dependencies only
- Review each package's changelog before major version updates

## Resources

- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [GitHub Advisory Database](https://github.com/advisories)
- [Snyk Vulnerability Database](https://snyk.io/vuln/)

---

**Action Required:** Review this report and execute the update plan in phases, testing thoroughly after each phase.
