import { describe, expect, it } from "vitest";

import {
  analyzeTapResults,
  buildVerifiedTlsConfig,
  collectTapFailures,
} from "./cloud-db-test-runner.mjs";

const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

describe("collectTapFailures", () => {
  it("returns no failures for successful pgTAP output", () => {
    expect(
      collectTapFailures([
        { plan: "1..2" },
        { has_table: "ok 1 - profiles exists" },
        { policies_are: "ok 2 - profiles policies are exact" },
      ]),
    ).toEqual([]);
  });

  it("returns every not-ok pgTAP result", () => {
    expect(
      collectTapFailures([
        { has_table: "not ok 1 - profiles exists" },
        { diagnostics: "# Missing table public.profiles" },
        { has_column: "not ok 2 - role exists" },
      ]),
    ).toEqual([
      "not ok 1 - profiles exists",
      "not ok 2 - role exists",
    ]);
  });

  it("finds failures in multi-statement query results", () => {
    expect(
      collectTapFailures([
        { rows: [{ plan: "1..1" }] },
        { rows: [{ finish: "not ok 1 - RLS enabled" }] },
      ]),
    ).toEqual(["not ok 1 - RLS enabled"]);
  });
});

describe("analyzeTapResults", () => {
  it("rejects SQL output that does not contain a TAP plan", () => {
    expect(() => analyzeTapResults([{ result: "plain SQL output" }])).toThrow(
      /TAP plan/,
    );
  });

  it("accepts planned successful TAP output", () => {
    expect(
      analyzeTapResults([
        { plan: "1..1" },
        { assertion: "ok 1 - schema is secure" },
      ]),
    ).toEqual({ assertionCount: 1, plannedCount: 1 });
  });
});

describe("buildVerifiedTlsConfig", () => {
  it("pins the Supabase root CA while retaining certificate verification", () => {
    expect(buildVerifiedTlsConfig(SUPABASE_ROOT_CA)).toEqual({
      ca: SUPABASE_ROOT_CA,
      rejectUnauthorized: true,
    });
  });

  it("rejects an unverified certificate", () => {
    expect(() =>
      buildVerifiedTlsConfig(
        SUPABASE_ROOT_CA.replace("MIIDxD", "MIIDxE"),
      ),
    ).toThrow(/verified Supabase Root 2021 CA/);
  });
});
