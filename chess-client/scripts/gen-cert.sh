#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="${CERT_DIR:-$(dirname "$0")/../.certs}"
KEY_FILE="$CERT_DIR/code-signing.key"
CERT_FILE="$CERT_DIR/code-signing.crt"
PFX_FILE="$CERT_DIR/code-signing.pfx"
PFX_PASSWORD="${PFX_PASSWORD:-chess-client-selfsigned}"
DAYS="${DAYS:-3650}"

mkdir -p "$CERT_DIR"

if [ -f "$PFX_FILE" ]; then
  echo "Certificate already exists at $PFX_FILE"
  echo "To regenerate, delete the files in $CERT_DIR and re-run"
  exit 0
fi

echo "Generating self-signed code signing certificate..."

CONFIG_FILE=$(mktemp /tmp/openssl-codesign.XXXXXX)
cat > "$CONFIG_FILE" << EOC
distinguished_name = req_distinguished_name
prompt = no
x509_extensions = codesign

[req_distinguished_name]
CN = Chess Client Development
O = Chess App
OU = Development

[codesign]
extendedKeyUsage = codeSigning
basicConstraints = critical,CA:FALSE
EOC

openssl req -x509 -newkey rsa:4096 -keyout "$KEY_FILE" -out "$CERT_FILE" \
  -days "$DAYS" -nodes \
  -extensions codesign \
  -config "$CONFIG_FILE"

rm -f "$CONFIG_FILE"

openssl pkcs12 -export -out "$PFX_FILE" \
  -inkey "$KEY_FILE" -in "$CERT_FILE" \
  -passout "pass:$PFX_PASSWORD"

echo ""
echo "Certificate generated:"
echo "  PFX:  $PFX_FILE"
echo "  Pass: $PFX_PASSWORD"
echo ""
echo "To trust this certificate on Windows, run as Administrator:"
echo "  certutil -addTrustedRootCertificate \"$(dirname "$0")/../.certs/code-signing.crt\""
echo ""
echo "For CI/CD, base64-encode the PFX and set it as WIN_CSC_LINK secret:"
echo "  base64 -w0 \"$PFX_FILE\" | xclip -selection clipboard"
