/**
 * Tests for GoogleKmsSigner.
 *
 * Unit tests: Pure logic (algorithm mapping, resource name building, error handling)
 * Integration tests: Real KMS (skipped without GCP credentials)
 */

import { beforeAll, describe, expect, it } from "vitest";

import { KmsSignerError } from "../types";
import { buildKeyVersionName, isRsaPss, mapKmsAlgorithm } from "./google-kms";

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: Algorithm Mapping
// ─────────────────────────────────────────────────────────────────────────────

describe("mapKmsAlgorithm", () => {
  describe("RSA PKCS#1 v1.5 algorithms", () => {
    it("maps RSA_SIGN_PKCS1_2048_SHA256", () => {
      const result = mapKmsAlgorithm("RSA_SIGN_PKCS1_2048_SHA256");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSASSA-PKCS1-v1_5",
        digestAlgorithm: "SHA-256",
      });
    });

    it("maps RSA_SIGN_PKCS1_3072_SHA256", () => {
      const result = mapKmsAlgorithm("RSA_SIGN_PKCS1_3072_SHA256");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSASSA-PKCS1-v1_5",
        digestAlgorithm: "SHA-256",
      });
    });

    it("maps RSA_SIGN_PKCS1_4096_SHA256", () => {
      const result = mapKmsAlgorithm("RSA_SIGN_PKCS1_4096_SHA256");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSASSA-PKCS1-v1_5",
        digestAlgorithm: "SHA-256",
      });
    });

    it("maps RSA_SIGN_PKCS1_4096_SHA512", () => {
      const result = mapKmsAlgorithm("RSA_SIGN_PKCS1_4096_SHA512");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSASSA-PKCS1-v1_5",
        digestAlgorithm: "SHA-512",
      });
    });
  });

  describe("RSA-PSS algorithms", () => {
    it("maps RSA_SIGN_PSS_2048_SHA256", () => {
      const result = mapKmsAlgorithm("RSA_SIGN_PSS_2048_SHA256");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSA-PSS",
        digestAlgorithm: "SHA-256",
      });
    });

    it("maps RSA_SIGN_PSS_3072_SHA256", () => {
      const result = mapKmsAlgorithm("RSA_SIGN_PSS_3072_SHA256");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSA-PSS",
        digestAlgorithm: "SHA-256",
      });
    });

    it("maps RSA_SIGN_PSS_4096_SHA256", () => {
      const result = mapKmsAlgorithm("RSA_SIGN_PSS_4096_SHA256");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSA-PSS",
        digestAlgorithm: "SHA-256",
      });
    });

    it("maps RSA_SIGN_PSS_4096_SHA512", () => {
      const result = mapKmsAlgorithm("RSA_SIGN_PSS_4096_SHA512");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSA-PSS",
        digestAlgorithm: "SHA-512",
      });
    });
  });

  describe("ECDSA algorithms", () => {
    it("maps EC_SIGN_P256_SHA256", () => {
      const result = mapKmsAlgorithm("EC_SIGN_P256_SHA256");

      expect(result).toEqual({
        keyType: "EC",
        signatureAlgorithm: "ECDSA",
        digestAlgorithm: "SHA-256",
      });
    });

    it("maps EC_SIGN_P384_SHA384", () => {
      const result = mapKmsAlgorithm("EC_SIGN_P384_SHA384");

      expect(result).toEqual({
        keyType: "EC",
        signatureAlgorithm: "ECDSA",
        digestAlgorithm: "SHA-384",
      });
    });

    it("maps EC_SIGN_P521_SHA512", () => {
      const result = mapKmsAlgorithm("EC_SIGN_P521_SHA512");

      expect(result).toEqual({
        keyType: "EC",
        signatureAlgorithm: "ECDSA",
        digestAlgorithm: "SHA-512",
      });
    });
  });

  describe("rejected algorithms", () => {
    it("rejects EC_SIGN_SECP256K1_SHA256 with clear error", () => {
      expect(() => mapKmsAlgorithm("EC_SIGN_SECP256K1_SHA256")).toThrow(KmsSignerError);

      expect(() => mapKmsAlgorithm("EC_SIGN_SECP256K1_SHA256")).toThrow(
        /secp256k1.*P-256.*P-384.*P-521/,
      );
    });
  });

  describe("unknown algorithms", () => {
    it("throws for unknown algorithm", () => {
      expect(() => mapKmsAlgorithm("UNKNOWN_ALGORITHM")).toThrow(KmsSignerError);

      expect(() => mapKmsAlgorithm("UNKNOWN_ALGORITHM")).toThrow(/Unsupported KMS algorithm/);
    });

    it("includes algorithm name in error message", () => {
      expect(() => mapKmsAlgorithm("SOME_FUTURE_ALGORITHM")).toThrow("SOME_FUTURE_ALGORITHM");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: RSA-PSS Detection
// ─────────────────────────────────────────────────────────────────────────────

describe("isRsaPss", () => {
  it("returns true for RSA-PSS algorithms", () => {
    expect(isRsaPss("RSA_SIGN_PSS_2048_SHA256")).toBe(true);
    expect(isRsaPss("RSA_SIGN_PSS_3072_SHA256")).toBe(true);
    expect(isRsaPss("RSA_SIGN_PSS_4096_SHA256")).toBe(true);
    expect(isRsaPss("RSA_SIGN_PSS_4096_SHA512")).toBe(true);
  });

  it("returns false for RSA PKCS#1 v1.5 algorithms", () => {
    expect(isRsaPss("RSA_SIGN_PKCS1_2048_SHA256")).toBe(false);
    expect(isRsaPss("RSA_SIGN_PKCS1_3072_SHA256")).toBe(false);
    expect(isRsaPss("RSA_SIGN_PKCS1_4096_SHA256")).toBe(false);
    expect(isRsaPss("RSA_SIGN_PKCS1_4096_SHA512")).toBe(false);
  });

  it("returns false for ECDSA algorithms", () => {
    expect(isRsaPss("EC_SIGN_P256_SHA256")).toBe(false);
    expect(isRsaPss("EC_SIGN_P384_SHA384")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: Resource Name Building
// ─────────────────────────────────────────────────────────────────────────────

describe("buildKeyVersionName", () => {
  it("builds full resource name from shorthand options", () => {
    const result = buildKeyVersionName({
      projectId: "my-project",
      locationId: "us-east1",
      keyRingId: "my-ring",
      keyId: "my-key",
      certificate: new Uint8Array(),
    });

    expect(result).toBe(
      "projects/my-project/locations/us-east1/keyRings/my-ring/cryptoKeys/my-key/cryptoKeyVersions/1",
    );
  });

  it("defaults keyVersion to 1", () => {
    const result = buildKeyVersionName({
      projectId: "test-project",
      locationId: "europe-west1",
      keyRingId: "test-ring",
      keyId: "test-key",
      certificate: new Uint8Array(),
    });

    expect(result).toContain("/cryptoKeyVersions/1");
  });

  it("uses explicit keyVersion when provided", () => {
    const result = buildKeyVersionName({
      projectId: "my-project",
      locationId: "us-east1",
      keyRingId: "my-ring",
      keyId: "my-key",
      keyVersion: "42",
      certificate: new Uint8Array(),
    });

    expect(result).toBe(
      "projects/my-project/locations/us-east1/keyRings/my-ring/cryptoKeys/my-key/cryptoKeyVersions/42",
    );
  });

  it("handles special characters in IDs", () => {
    const result = buildKeyVersionName({
      projectId: "project-with-dashes",
      locationId: "us-central1-a",
      keyRingId: "ring_with_underscores",
      keyId: "key-123",
      certificate: new Uint8Array(),
    });

    expect(result).toBe(
      "projects/project-with-dashes/locations/us-central1-a/keyRings/ring_with_underscores/cryptoKeys/key-123/cryptoKeyVersions/1",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: KmsSignerError
// ─────────────────────────────────────────────────────────────────────────────

describe("KmsSignerError", () => {
  it("prefixes message with KMS:", () => {
    const error = new KmsSignerError("Something went wrong");

    expect(error.message).toBe("KMS: Something went wrong");
  });

  it("has correct name", () => {
    const error = new KmsSignerError("test");

    expect(error.name).toBe("KmsSignerError");
  });

  it("stores cause when provided", () => {
    const cause = new Error("Original error");
    const error = new KmsSignerError("Wrapped error", cause);

    expect(error.cause).toBe(cause);
  });

  it("is an instance of Error", () => {
    const error = new KmsSignerError("test");

    expect(error).toBeInstanceOf(Error);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests (Skipped without GCP credentials)
// ─────────────────────────────────────────────────────────────────────────────

// Integration tests require:
// - GCP credentials (GOOGLE_APPLICATION_CREDENTIALS or ADC via `gcloud auth application-default login`)
// - TEST_KMS_RSA_KEY env var with full resource name of test RSA key
// - TEST_KMS_EC_KEY env var with full resource name of test EC key
// - TEST_KMS_RSA_CERT env var with path to DER certificate for RSA key
// - TEST_KMS_EC_CERT env var with path to DER certificate for EC key

import { PDF } from "#src/api/pdf.ts";
import { loadFixture, saveTestOutput } from "#src/test-utils.ts";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { GoogleKmsSigner } from "./google-kms";

// Check for GCP credentials: explicit env var OR default ADC location
const hasGcpCredentials =
  !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  fs.existsSync(path.join(os.homedir(), ".config/gcloud/application_default_credentials.json"));

const rsaKeyVersion = process.env.TEST_KMS_RSA_KEY;
const ecKeyVersion = process.env.TEST_KMS_EC_KEY;
const rsaCertPath = process.env.TEST_KMS_RSA_CERT;
const ecCertPath = process.env.TEST_KMS_EC_CERT;
const rsaCertSecret = process.env.TEST_KMS_RSA_CERT_SECRET;
const ecCertSecret = process.env.TEST_KMS_EC_CERT_SECRET;

// Skip if no credentials or no test keys configured
const canRunIntegrationTests = hasGcpCredentials && (rsaKeyVersion || ecKeyVersion);

describe.skipIf(!canRunIntegrationTests)("GoogleKmsSigner integration", () => {
  let rsaCertificate: Uint8Array;
  let ecCertificate: Uint8Array;

  beforeAll(async () => {
    // Load test certificates if paths are provided
    if (rsaCertPath) {
      const fsPromises = await import("fs/promises");
      rsaCertificate = new Uint8Array(await fsPromises.readFile(rsaCertPath));
    }
    if (ecCertPath) {
      const fsPromises = await import("fs/promises");
      ecCertificate = new Uint8Array(await fsPromises.readFile(ecCertPath));
    }
  });

  describe.skipIf(!rsaKeyVersion || !rsaCertPath)("RSA signing", () => {
    it("creates signer with RSA PKCS#1 v1.5 key", async () => {
      const signer = await GoogleKmsSigner.create({
        keyVersionName: rsaKeyVersion!,
        certificate: rsaCertificate,
      });

      expect(signer.keyType).toBe("RSA");
      expect(signer.signatureAlgorithm).toBe("RSASSA-PKCS1-v1_5");
      expect(signer.keyVersionName).toBe(rsaKeyVersion);
    });

    it("signs data with RSA key", async () => {
      const signer = await GoogleKmsSigner.create({
        keyVersionName: rsaKeyVersion!,
        certificate: rsaCertificate,
      });

      const testData = new TextEncoder().encode("Hello, World!");
      const signature = await signer.sign(testData, signer.digestAlgorithm);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBeGreaterThan(0);
    });
  });

  describe.skipIf(!ecKeyVersion || !ecCertPath)("ECDSA signing", () => {
    it("creates signer with ECDSA key", async () => {
      const signer = await GoogleKmsSigner.create({
        keyVersionName: ecKeyVersion!,
        certificate: ecCertificate,
      });

      expect(signer.keyType).toBe("EC");
      expect(signer.signatureAlgorithm).toBe("ECDSA");
      expect(signer.keyVersionName).toBe(ecKeyVersion);
    });

    it("signs data with ECDSA key", async () => {
      const signer = await GoogleKmsSigner.create({
        keyVersionName: ecKeyVersion!,
        certificate: ecCertificate,
      });

      const testData = new TextEncoder().encode("Hello, World!");
      const signature = await signer.sign(testData, signer.digestAlgorithm);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBeGreaterThan(0);
    });
  });

  describe.skipIf(!rsaKeyVersion)("error handling", () => {
    it("rejects mismatched certificate", async () => {
      // Create a dummy certificate that won't match the KMS key
      const wrongCertificate = new Uint8Array([
        0x30,
        0x82,
        0x01,
        0x22, // SEQUENCE header (fake cert structure)
        0x30,
        0x0d,
        0x06,
        0x09,
        0x2a,
        0x86,
        0x48,
        0x86,
        0xf7,
        0x0d,
        0x01,
        0x01,
        0x01,
        0x05,
        0x00,
      ]);

      await expect(
        GoogleKmsSigner.create({
          keyVersionName: rsaKeyVersion!,
          certificate: wrongCertificate,
        }),
      ).rejects.toThrow();
    });

    it("rejects non-existent key", async () => {
      await expect(
        GoogleKmsSigner.create({
          keyVersionName:
            "projects/fake-project/locations/us/keyRings/fake/cryptoKeys/fake/cryptoKeyVersions/1",
          certificate: rsaCertificate,
        }),
      ).rejects.toThrow(KmsSignerError);
    });

    it("rejects wrong digest algorithm in sign()", async () => {
      const signer = await GoogleKmsSigner.create({
        keyVersionName: rsaKeyVersion!,
        certificate: rsaCertificate,
      });

      const testData = new TextEncoder().encode("test");

      // Request a different digest than what the key supports
      const wrongDigest = signer.digestAlgorithm === "SHA-256" ? "SHA-512" : "SHA-256";

      await expect(signer.sign(testData, wrongDigest)).rejects.toThrow(/Digest algorithm mismatch/);
    });
  });

  describe.skipIf(!rsaKeyVersion || !rsaCertPath)("shorthand options", () => {
    it("creates signer with shorthand options", async () => {
      // Parse the full resource name to extract components
      const match = rsaKeyVersion!.match(
        /projects\/([^/]+)\/locations\/([^/]+)\/keyRings\/([^/]+)\/cryptoKeys\/([^/]+)\/cryptoKeyVersions\/(\d+)/,
      );

      if (!match) {
        throw new Error(`Invalid key version format: ${rsaKeyVersion}`);
      }

      const [, projectId, locationId, keyRingId, keyId, keyVersion] = match;

      const signer = await GoogleKmsSigner.create({
        projectId,
        locationId,
        keyRingId,
        keyId,
        keyVersion,
        certificate: rsaCertificate,
      });

      expect(signer.keyVersionName).toBe(rsaKeyVersion);
    });
  });

  describe.skipIf(!rsaKeyVersion || !rsaCertPath)("PDF signing with RSA", () => {
    it("signs a PDF document with HSM-backed RSA key", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const signer = await GoogleKmsSigner.create({
        keyVersionName: rsaKeyVersion!,
        certificate: rsaCertificate,
      });

      const { bytes, warnings } = await pdf.sign({
        signer,
        reason: "Signed with Google Cloud KMS (HSM-backed RSA key)",
        location: "Integration Test",
      });

      // Should produce valid PDF
      expect(bytes.length).toBeGreaterThan(pdfBytes.length);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

      // Should have no warnings
      expect(warnings).toHaveLength(0);

      // Should contain signature dictionary
      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/Type /Sig");
      expect(pdfStr).toContain("/Filter /Adobe.PPKLite");

      // Save for manual inspection
      await saveTestOutput("signatures/gcp-kms-signed-rsa.pdf", bytes);
    });
  });

  describe.skipIf(!ecKeyVersion || !ecCertPath)("PDF signing with ECDSA", () => {
    it("signs a PDF document with HSM-backed ECDSA key", async () => {
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const signer = await GoogleKmsSigner.create({
        keyVersionName: ecKeyVersion!,
        certificate: ecCertificate,
      });

      const { bytes, warnings } = await pdf.sign({
        signer,
        reason: "Signed with Google Cloud KMS (HSM-backed ECDSA key)",
        location: "Integration Test",
      });

      // Should produce valid PDF
      expect(bytes.length).toBeGreaterThan(pdfBytes.length);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

      // Should have no warnings
      expect(warnings).toHaveLength(0);

      // Should contain signature dictionary
      const pdfStr = new TextDecoder().decode(bytes);
      expect(pdfStr).toContain("/Type /Sig");
      expect(pdfStr).toContain("/Filter /Adobe.PPKLite");

      // Save for manual inspection
      await saveTestOutput("signatures/gcp-kms-signed-ecdsa.pdf", bytes);
    });
  });

  describe.skipIf(!rsaCertSecret || !rsaKeyVersion)("Secret Manager integration", () => {
    it("loads certificate from Secret Manager and signs PDF", async () => {
      // Load certificate from Secret Manager
      const { cert } = await GoogleKmsSigner.getCertificateFromSecretManager(rsaCertSecret!);

      expect(cert).toBeInstanceOf(Uint8Array);
      expect(cert.length).toBeGreaterThan(0);

      // Certificate should match the one we have locally
      expect(cert).toEqual(rsaCertificate);

      // Create signer using the certificate from Secret Manager
      const signer = await GoogleKmsSigner.create({
        keyVersionName: rsaKeyVersion!,
        certificate: cert,
      });

      expect(signer.keyType).toBe("RSA");

      // Sign a PDF
      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const { bytes, warnings } = await pdf.sign({
        signer,
        reason: "Signed with cert from Secret Manager",
        location: "Integration Test",
      });

      expect(bytes.length).toBeGreaterThan(pdfBytes.length);
      expect(warnings).toHaveLength(0);

      await saveTestOutput("signatures/gcp-kms-signed-secretmanager.pdf", bytes);
    });

    it("loads EC certificate from Secret Manager", async () => {
      if (!ecCertSecret) {
        return;
      }

      const { cert } = await GoogleKmsSigner.getCertificateFromSecretManager(ecCertSecret);

      expect(cert).toBeInstanceOf(Uint8Array);
      expect(cert).toEqual(ecCertificate);
    });
  });
});
