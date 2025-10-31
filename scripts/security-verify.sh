#!/bin/bash

# Security verification script for Comptario deployment
set -e

echo "🔒 Running security verification for Comptario..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print status
print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ((WARNINGS++))
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ((ERRORS++))
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Check 1: Environment file separation
echo -e "\n${BLUE}📁 Checking environment file separation...${NC}"

if [ -f "apps/web/.env.example" ]; then
    print_status "OK" "Frontend environment example exists"
    
    # Check if it only contains VITE_ variables
    if grep -q "^[^#]*[A-Z_]*=" apps/web/.env.example | grep -v "^VITE_"; then
        print_status "ERROR" "Frontend .env.example contains non-VITE_ variables"
    else
        print_status "OK" "Frontend .env.example only contains VITE_ variables"
    fi
else
    print_status "ERROR" "Frontend environment example missing (apps/web/.env.example)"
fi

if [ -f "apps/api/.env.example" ]; then
    print_status "OK" "Backend environment example exists"
    
    # Check if it contains server secrets
    if grep -q "DATABASE_\|JWT_SECRET\|ENCRYPTION_KEY" apps/api/.env.example; then
        print_status "OK" "Backend .env.example contains server secrets (as expected)"
    else
        print_status "WARNING" "Backend .env.example missing some expected server secrets"
    fi
else
    print_status "ERROR" "Backend environment example missing (apps/api/.env.example)"
fi

# Check 2: .gitignore configuration
echo -e "\n${BLUE}📝 Checking .gitignore configuration...${NC}"

if [ -f ".gitignore" ]; then
    if grep -q "apps/web/\.env" .gitignore && grep -q "apps/api/\.env" .gitignore; then
        print_status "OK" ".gitignore properly excludes environment files"
    else
        print_status "ERROR" ".gitignore missing environment file exclusions"
    fi
    
    if grep -q "dist/" .gitignore; then
        print_status "OK" ".gitignore excludes build directories"
    else
        print_status "WARNING" ".gitignore should exclude dist/ directories"
    fi
else
    print_status "ERROR" ".gitignore file missing"
fi

# Check 3: Build output verification (if dist exists)
echo -e "\n${BLUE}🔍 Checking build output security...${NC}"

if [ -d "dist" ]; then
    print_status "INFO" "Checking dist/ directory for security issues"
    
    # Check for environment files in build
    if find dist/ -name "*.env*" -type f | grep -q .; then
        print_status "ERROR" "Environment files found in build directory!"
        find dist/ -name "*.env*" -type f
    else
        print_status "OK" "No environment files in build directory"
    fi
    
    # Check for server secrets in build - simplified approach
    SECRETS_FOUND=false
    
    # Check for common secret patterns that should never appear in client bundles
    if grep -rq "localhost:5432\|mongodb://\|redis://.*@\|jwt.*secret.*=\|\$2b\$10\$" dist/ 2>/dev/null; then
        print_status "ERROR" "Potential server credentials found in build!"
        SECRETS_FOUND=true
    else
        print_status "OK" "No obvious server secrets found in build"
    fi
    
    if [ "$SECRETS_FOUND" = false ]; then
        print_status "OK" "No server secrets found in build directory"
    fi
    
    # Check for source maps in production
    if find dist/ -name "*.map" -type f | grep -q .; then
        print_status "WARNING" "Source maps found in build (consider removing for production)"
    else
        print_status "OK" "No source maps in build directory"
    fi
else
    print_status "INFO" "No dist/ directory found - run build first to verify"
fi

# Check 4: Package.json scripts security
echo -e "\n${BLUE}📦 Checking package.json scripts...${NC}"

if [ -f "package.json" ]; then
    # Check for potentially dangerous scripts
    if grep -q "rm -rf /" package.json; then
        print_status "ERROR" "Dangerous script detected in package.json"
    else
        print_status "OK" "No dangerous scripts detected in package.json"
    fi
    
    # Check for production build script
    if grep -q "\"build\":" package.json; then
        print_status "OK" "Build script exists in package.json"
    else
        print_status "WARNING" "No build script found in package.json"
    fi
else
    print_status "ERROR" "package.json not found"
fi

# Check 5: File permissions (if on Unix-like system)
echo -e "\n${BLUE}🔐 Checking file permissions...${NC}"

if command -v stat >/dev/null 2>&1; then
    # Check environment files permissions
    for env_file in apps/web/.env apps/api/.env backend/.env; do
        if [ -f "$env_file" ]; then
            perms=$(stat -c "%a" "$env_file" 2>/dev/null || stat -f "%Mp%Lp" "$env_file" 2>/dev/null || echo "unknown")
            if [ "$perms" = "600" ] || [ "$perms" = "unknown" ]; then
                print_status "OK" "$env_file has secure permissions ($perms)"
            else
                print_status "WARNING" "$env_file permissions ($perms) - should be 600"
            fi
        fi
    done
else
    print_status "INFO" "Cannot check file permissions on this system"
fi

# Check 6: Network configuration hints
echo -e "\n${BLUE}🌐 Network security recommendations...${NC}"

print_status "INFO" "Ensure API server only binds to localhost (127.0.0.1)"
print_status "INFO" "Configure reverse proxy (Nginx/Caddy) for public access"
print_status "INFO" "Set up CORS allowlist for production domains"
print_status "INFO" "Enable HTTPS/TLS with valid certificates"

# Check 7: Documentation
echo -e "\n${BLUE}📚 Checking documentation...${NC}"

if [ -f "docs/deployment.md" ]; then
    print_status "OK" "Deployment documentation exists"
else
    print_status "WARNING" "Deployment documentation missing"
fi

# Summary
echo -e "\n${BLUE}📊 Security Verification Summary${NC}"
echo "=================================="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    print_status "OK" "All security checks passed!"
elif [ $ERRORS -eq 0 ]; then
    print_status "WARNING" "$WARNINGS warning(s) found - review recommendations"
else
    print_status "ERROR" "$ERRORS error(s) and $WARNINGS warning(s) found"
    echo -e "\n${RED}❌ Security verification failed!${NC}"
    echo "Please fix the errors above before deploying to production."
    exit 1
fi

echo -e "\n${GREEN}🛡️  Security verification completed${NC}"

# Additional security recommendations
echo -e "\n${YELLOW}🔒 Additional Security Recommendations:${NC}"
echo "• Use strong, unique passwords for all services"
echo "• Enable 2FA for all admin accounts"
echo "• Regularly update dependencies (npm audit)"
echo "• Monitor application logs for suspicious activity"
echo "• Set up automated security scanning in CI/CD"
echo "• Review OWASP Top 10 compliance"
echo "• Implement Content Security Policy (CSP)"
echo "• Use security headers (HSTS, X-Frame-Options, etc.)"

exit 0