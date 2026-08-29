import { ServiceNowSettingsError } from "../settings/errors.js";
import {
  DEFAULT_FLUENT_MANIFEST,
  type FluentApiCapability,
  type FluentSdkManifest,
} from "./manifest.js";
import { FLUENT_DECLARATION_SNAPSHOTS } from "./declaration-snapshots.js";

/** Reviewed default used when `fluentSdkVersion` is omitted. */
export const DEFAULT_FLUENT_SDK_VERSION = "4.11.0";
/** @deprecated Use {@link DEFAULT_FLUENT_SDK_VERSION}. */
export const CURRENT_FLUENT_SDK_VERSION = DEFAULT_FLUENT_SDK_VERSION;
export const LEGACY_FLUENT_SDK_VERSION = "3.0.0";
export const SDK_4_1_FLUENT_SDK_VERSION = "4.1.0";
export const SDK_4_8_FLUENT_SDK_VERSION = "4.8.0";
export const SDK_4_10_FLUENT_SDK_VERSION = "4.10.0";
export const SDK_4_10_1_FLUENT_SDK_VERSION = "4.10.1";

export const SUPPORTED_FLUENT_SDK_VERSIONS = [
  "3.0.0",
  "3.0.1",
  "3.0.2",
  "3.0.3",
  "4.0.0",
  "4.0.1",
  "4.0.2",
  "4.1.0",
  "4.1.1",
  "4.2.0",
  "4.3.0",
  "4.4.0",
  "4.4.1",
  "4.5.0",
  "4.6.0",
  "4.6.1",
  "4.7.0",
  "4.7.1",
  "4.7.2",
  "4.8.0",
  "4.8.1",
  "4.9.0",
  "4.9.1",
  "4.9.2",
  "4.10.0",
  "4.10.1",
  "4.11.0",
] as const;

export type SupportedFluentSdkVersion = (typeof SUPPORTED_FLUENT_SDK_VERSIONS)[number];

export interface FluentSdkArtifactEvidence {
  readonly sdkIntegrity: `sha512-${string}`;
  readonly coreIntegrity: `sha512-${string}`;
}

/** Exact npm artifact pairs used for the reviewed declaration manifests. */
export const FLUENT_SDK_ARTIFACTS: Readonly<
  Record<SupportedFluentSdkVersion, FluentSdkArtifactEvidence>
> = Object.freeze({
  "3.0.0": {
    sdkIntegrity:
      "sha512-4m5MRfbZyPNPEj3V2nBMnwMni9y/TOwL32xevCkybIYikU4jxGgwPq4v91qF1nPB8F7HUk32CfREzvogsK+dFQ==",
    coreIntegrity:
      "sha512-ImnXsM/fMeZRWsmS9AU+ec2TdrVzxzsNqP9FVLCLA3D3Xhpspn1xO7VTP4McpZP3EAGyrJgXH5g+lowK/FGt1A==",
  },
  "3.0.1": {
    sdkIntegrity:
      "sha512-7UKnXHSpjb6UwOJmQVUvqI9l+72+AtzwVJ1Ryn1DXDzPfkJW7zJHGSEmVeM6w7PA56AUML9AljBr1Uc/Y6fPrg==",
    coreIntegrity:
      "sha512-7w6gdmwFpGl5dV7/pGufQHKuqAb1Ea+ItXaUkMIgi2ngvDJOMXyz8wujb+0ORUDXp90p7KYZQ0X/D/KFg3MSFQ==",
  },
  "3.0.2": {
    sdkIntegrity:
      "sha512-Y8etx8I2tefe1X+hMBJWg1g8dDhA7/gfuUI7mMo3Hvg9e/cX7NAo6rbCSAXzCiDvlrCnYQbcIq/5cElWzMnSzw==",
    coreIntegrity:
      "sha512-F9cnMQBjXXHvpr3zlEVoYI2sEIyGCGz33pu9MjYRfWpZNv8vZGQR72rHWVdZ/bSwL0kTUiq05j48waso9QKnng==",
  },
  "3.0.3": {
    sdkIntegrity:
      "sha512-uWjv+WO+r483C3BX3vmfHxnrbXoxcHxyA1L69+aBRtxlNhBauKtf9WGstlhPaIH34V2vr8uT3sv85XiEqAAdvg==",
    coreIntegrity:
      "sha512-5B5o9D2bjNUB98mIJMJP8j3ZXE4+Aqd+SnCU6ANIB+gWwBjAn4rrB6PbTxQZUFXIdZHcwPQYnpYY9nDQxxs9Lg==",
  },
  "4.0.0": {
    sdkIntegrity:
      "sha512-dhSnSmprrQO2cZJ/o5KajpOE3ifiQjdx2zhdG6KRWfOkHkpEXOJKoCkXLA2U+fZd5TWCzsvkEcAUAE2gHsa5tg==",
    coreIntegrity:
      "sha512-vOW3+inEAG7dxVJn0yNxTVxBr5DVcI3NebhSbFifkPfiySRE+eZw6T0FslgKQ1M/9BSshEHuSXtXmFj1GDsT7A==",
  },
  "4.0.1": {
    sdkIntegrity:
      "sha512-RJ356rYghMqxJ+EvWumjS3P0esQIGfvyI7suSzdBAbJkHPLMiYlAfP4PtDNj5mBURf4ZNQoL1mCPeG57/vA+3A==",
    coreIntegrity:
      "sha512-CADvN566g0YtW9eojZHRDRp16i7HRL0lqFwJe7yL4H5YHL91i2ZzhFGgzqFtGGququGpv9rcTiNzE/1etSvmXw==",
  },
  "4.0.2": {
    sdkIntegrity:
      "sha512-AEoBVedfTxI3RmorkgSUg9YQSfXrv8Q/5Me7jbcTsmhaiiEKqpLLfdMFGQdFX0R3RGEoveXcVR/AzTRKbFUP8Q==",
    coreIntegrity:
      "sha512-VW2a6v87xQ5mzPU9LPuAwizR0VpPDyu/xU0owoYaBHAhq4sbf1sFK2dvPMcSF6/BbOe6QehEicyYgL5QNZ8uKA==",
  },
  "4.1.0": {
    sdkIntegrity:
      "sha512-aZCMFOAQne01tYwl2Fku8WD9rLht0Caje+LqjcuuWWobFIltSzdaFpSGpsR203xhBCS7u4Wyu3LiP6fvulP7BQ==",
    coreIntegrity:
      "sha512-sgV5mKKS3nxsgHqg/57kFM0hqU7jFLuHRZl0c3kdR3gAtYg1tjzo9cIYZEARBIw4SKpk6FEkCnNLH3fGmBSHqA==",
  },
  "4.1.1": {
    sdkIntegrity:
      "sha512-3MjZXZXQnE53tuAe0mLaQXEUxM/sDD+DkssEH1j2AB/3k6plbxgi3jkDpKfJ6345bsQHQHNMTj2tPja8ZYjw7g==",
    coreIntegrity:
      "sha512-OX1TfKVj2rJg4V3Kz+1Uu6YHt7p+ztEp9p0pTw6TZ4X3vFMBevzlJw3Tx0d4aly+p0zQOdjXSf87GRL/8Tuj3w==",
  },
  "4.2.0": {
    sdkIntegrity:
      "sha512-epeStZFkO0dhMTuQJ+r6wDSuKBEqb7Dt9g2RIidyVMIjdMeJLa1jeku2lqo50xb72ahdKSuXJfBwa6cYatRiyg==",
    coreIntegrity:
      "sha512-wWyFjyUayCOIoFGQutL4Ju0kL7AwhGLngcsgZc8pUkqoEzHPC7mia8pmPiU4TnNtB4FqRjMGGiSjc00F0ze4sg==",
  },
  "4.3.0": {
    sdkIntegrity:
      "sha512-gcvwwM6Vql1YxU45qGfI1NaUqYDGO6hON7gcIFNopYx0ZS7TybemBXiuDY+Ukolg1juvYKYJyd/BK/Ya+ygtXA==",
    coreIntegrity:
      "sha512-n5nYTiATsFfpUYIvh8tbzxpYnyFppxwUT/aiYd15YHkxsWx2FDsZTKGs1u1+uZaj07r4C7mrZ/ReuoMB4NUZ+w==",
  },
  "4.4.0": {
    sdkIntegrity:
      "sha512-B7KFXCkPrYEXzJRUyxzTkGyTtTPDXAMOKvbL5VkaLdoY2NlYVdhMfglefMfXxxrrBX2l0ANdzH3z3ZjKt84eFw==",
    coreIntegrity:
      "sha512-c18cA70gRy8QWYPSItV+YAF2gRgzVmtOKL5l7TGlog50jCkAqGkPfYVvU98LmKzOHiEc+fnn3AnVLUc1bEnt5w==",
  },
  "4.4.1": {
    sdkIntegrity:
      "sha512-oq8ApxgSCfRih6MpRGVYyc2yQS1CV0dCvVoKKkSHNicHK7IchMsz4pG7kJHEWI7WtsGdwJs1ZQqnSATyNEzmvA==",
    coreIntegrity:
      "sha512-MxTHiKbXb92OnkTeSSjmePhqp0118KhjUGbYV8ibD2hxIyPde16CAmShnf+dRpLo+lrI+CJgolwhQYP1qAV9Ag==",
  },
  "4.5.0": {
    sdkIntegrity:
      "sha512-luqmAhQ6Pfh6lZ7lLEr7V6j1Nx8v/axgO9bnfx+l4FqzDuyGv2IZJDSa7sQ+1UEEY0mYJbrsEIeRv4eJuXYVMg==",
    coreIntegrity:
      "sha512-SE/S35PBFqKUMnKgG2ThMEfwR5HobOOBacn7LW9oqgbOQTDOI12sTeNnKN6dNxqJHLwsC+3wiZYf3PV+PWcP8Q==",
  },
  "4.6.0": {
    sdkIntegrity:
      "sha512-GUY9CGi1liYmpXFaAULblzgOXOCqs1w2cR+kmNNCTM/yQj24tGR4/r7Ym2i0UqzSCzYXkMeVMfelS1xSApbu1Q==",
    coreIntegrity:
      "sha512-JeEiLZGthq+uIbbt18eAWIylNTZaImoNpNNnA96qpnVp9brnnLmCNqxdGUWdN3TwC/jL+pQpaTiGgwukItnytw==",
  },
  "4.6.1": {
    sdkIntegrity:
      "sha512-7FSxr2z972qv6jOBTdQ51ar7Jul0oYaELS0HvtwDjzLIZsAt+YBTbFhdZveRxe+d8w4GbfOIpVAG6XOM2pqCdg==",
    coreIntegrity:
      "sha512-L3U+PSas6/R9WxtBUc/MOAeUXalQzFSVouPmuIfCOA434bsjx6cASbIuvPMMkPIm4bBwXVJZVDHp5WAyYa/xEg==",
  },
  "4.7.0": {
    sdkIntegrity:
      "sha512-8ji2/KscbcfwsC/QuSxrFOY3ZXoCpM8kbMPaEM7SMu9R6IkksqTz9eZBQWf1IxB2m0APJ0s+sep+RfaYhU7cjA==",
    coreIntegrity:
      "sha512-vZVtvuidnPx5oM59nSnUuyfpLUbujmoJaeVYUfgvduFyyMO1P8l9ru4SiqdEZVTAS9TJqwj60XCYlWMKnBKSPQ==",
  },
  "4.7.1": {
    sdkIntegrity:
      "sha512-F/rfcSXB+t73LHI+xDOijXp4b+49nP3/b/mpJWF168cOo1JkL67H6CV+8z5IkJL1GmfQHg8fXeg8J2mw49WPfw==",
    coreIntegrity:
      "sha512-4JCAfnk++ce1u1d8BCwsMF6nVw3CkbalsQ0FppgcNBnG/aI5Hy6TZWCRW6TlfbqY8BPs1OAY35NNkANoncNyBg==",
  },
  "4.7.2": {
    sdkIntegrity:
      "sha512-KL5vfErOnZoet9c3/4MVmiLZN+JDRG8/QAAoNBMCYiwYg3sBE7w3ET4YxGNijLcvEfcxlacV62Hxpzqv7g155g==",
    coreIntegrity:
      "sha512-ZCuUvZjR+PSyVesUqsjOTQXXx5pFjbOV9wXwEP7B2LUP6A4hdnc+OeIAaDnuy170c6ZqK/Iohp4K9WPQ4DYFLw==",
  },
  "4.8.0": {
    sdkIntegrity:
      "sha512-nOFGqFynTV+BdsUDOcfDNMI3SLPqSBjW7cifyklIqTsZPIynur73YRGMf9G8y08a+GqHaWX0HfvuWdtSAmTckw==",
    coreIntegrity:
      "sha512-TP/xhd4217NBnsY636ztc0WRf63WX0E2J5Ghttr1gilbrn38qGQ1/2/BPJcg63nehgApPbpMgE4GaSk2Oj/JRA==",
  },
  "4.8.1": {
    sdkIntegrity:
      "sha512-fSZZhy1wP6z5LtUGXqoW9f8C9sZA5i8HBLcMl0Pa2X/M80VAxaH/7o04MmWGxGxYoJ9Z6Kl5ecM8weTt+WlvUg==",
    coreIntegrity:
      "sha512-pZjRdGmu8KcEFWK35JzEMF/zJ9wNqQ5vaLOmb+9yTkXOJl15YsUrUUBDiPzo7Vs0u7LNhvH1hIg4/CnQ89W8MQ==",
  },
  "4.9.0": {
    sdkIntegrity:
      "sha512-LKsf3NwSv5RUppB2nsNRMqObnuIuh3lyUeHCUGMR/N7BjTgZM+bd3uyT0rwKpz/78eDkj6DN/gzGZMYe4/3ttQ==",
    coreIntegrity:
      "sha512-6ZJpD0MWe88xS44pybxAlEdkkB1bq2pGv6DQUnCfe5i2o/vOGKssBDdp1dnHRXkP2oT+OAfDpKkB/S6nZtEV7w==",
  },
  "4.9.1": {
    sdkIntegrity:
      "sha512-nfAija7QfWRrVfpgWALmjcEdJ1A/3PrUnW6BRddhuIJRF9kV9zwqnCtPj7ENY6fysRIu39epShTv+UNXwVBzvQ==",
    coreIntegrity:
      "sha512-SKgbinxAAyzPZFGE/9dlMtHI8x9HJphEbZx1aGtHC7xylk50hedtP/GJPSALNrxk/bOqpeV6ZWpV2ZSyaMrlMw==",
  },
  "4.9.2": {
    sdkIntegrity:
      "sha512-47dsT5k295sWZugMASeqT9bbUBwo6xvpcr0bNHqTdK4oCiUzWtC6N7o2cD2SlZ2yyzJz1cCt+tBoSr7U29evYw==",
    coreIntegrity:
      "sha512-0W8hZBOUxWVNXefAJ+GILU8wY3GC8TIst7lmk7nVzkWFN19EfyjlekzPiIoU8ydqMgCGj7J7mHNoY777guhAfQ==",
  },
  "4.10.0": {
    sdkIntegrity:
      "sha512-pWYYkMfmXdldCVP/35YlEfMrhc0qEmR16d+QeI2CepIyNQCMBxajVjLe+r8nsbsQZ8MaOhRjih51aHqG50HDFA==",
    coreIntegrity:
      "sha512-6+rfv+WhpKJdYfZvj91V5dMdqBB+8M8eKAJo75bm1MSl5PfqmRG2+SncCZz2Jt/oAe/Nrwu7pIXkKjDl0iwXRQ==",
  },
  "4.10.1": {
    sdkIntegrity:
      "sha512-ebmfymepmOjeRt3c0/gl6uqHx993Qyv//JPorS3SObrFWkEr+qtN2orsBBwq++Ejs16rZegF2WCYarnwmm00Lg==",
    coreIntegrity:
      "sha512-m+HoqUqp+PmfOxptYQEW7ywMO0FX3KfAfReBq5oZERaF0+m0OC64KFqxbETtZFyA4/doolzo4hkwGVu5mOTTtQ==",
  },
  "4.11.0": {
    sdkIntegrity:
      "sha512-ct+vgI/tdTXWng0XrDBDPPXVuXuU80iCQeFb90ZYaaCVmXho/6i4eKm/HOS7mQCT/Ty7tgErrL+lULQBNHltnA==",
    coreIntegrity:
      "sha512-0yUXUd1VcJV+BC6nQsVkJ1UNW3r3Yx1/fGyCs/9uMtLQqj0sBoM/F1mK3QUcnVBetF9PVcVzf9tShKvhyiSq+A==",
  },
});

const DECLARATIONS = FLUENT_DECLARATION_SNAPSHOTS;

function withSdkVersion(manifest: FluentSdkManifest, sdkVersion: string): FluentSdkManifest {
  return { ...manifest, version: `sdk-${sdkVersion}`, sdkVersion };
}

function manifestForVersion(sdkVersion: string): FluentSdkManifest {
  const snapshot = DECLARATIONS[sdkVersion];
  if (!snapshot) throw new Error(`missing declaration snapshot for ${sdkVersion}`);
  const manual = new Map(DEFAULT_FLUENT_MANIFEST.apis.map((api) => [api.name, api]));
  const apis: FluentApiCapability[] = [];
  for (const api of DEFAULT_FLUENT_MANIFEST.apis) {
    if (api.module === "unknown") {
      apis.push({ ...api });
      continue;
    }
    const declaration = snapshot.capabilities[api.name];
    if (!declaration) continue;
    const declaredPolicy = declaration.idPolicy;
    apis.push({
      ...api,
      idRequirement: declaredPolicy === "unknown" ? api.idRequirement : declaredPolicy,
      deprecated: declaredPolicy === "deprecated" ? sdkVersion : undefined,
    });
  }
  for (const [name, declaration] of Object.entries(snapshot.discoveredCapabilities)) {
    if (manual.has(name)) continue;
    const introduced = SUPPORTED_FLUENT_SDK_VERSIONS.find(
      (version) => DECLARATIONS[version]?.discoveredCapabilities[name],
    );
    const evidence = `https://registry.npmjs.org/@servicenow%2fsdk-core/-/sdk-core-${sdkVersion}.tgz`;
    apis.push({
      name,
      module: declaration.module,
      kind: "entity",
      idRequirement: "required",
      introduced,
      evidence,
      evidenceRecords: [
        {
          url: evidence,
          symbol: name,
          version: sdkVersion,
          transition: introduced === sdkVersion ? "introduced" : "current",
        },
      ],
    });
  }
  apis.sort((left, right) => left.name.localeCompare(right.name));
  return withSdkVersion({ ...DEFAULT_FLUENT_MANIFEST, apis }, sdkVersion);
}

const REGISTRY: Record<string, FluentSdkManifest> = Object.fromEntries(
  SUPPORTED_FLUENT_SDK_VERSIONS.map((version) => [version, manifestForVersion(version)]),
);

export function supportedFluentSdkVersionList(): string {
  return SUPPORTED_FLUENT_SDK_VERSIONS.join(", ");
}

/**
 * Select a Fluent SDK manifest. An omitted version uses the current public
 * @servicenow/sdk release; unsupported versions fail closed rather than
 * borrowing a nearby manifest.
 */
export function resolveFluentManifest(version: string | undefined): FluentSdkManifest {
  if (version === undefined) return REGISTRY[DEFAULT_FLUENT_SDK_VERSION]!;
  const selected = REGISTRY[version];
  if (!selected) {
    throw new ServiceNowSettingsError(
      ".fluentSdkVersion",
      `unsupported Fluent SDK version ${JSON.stringify(version)}. Supported: ${supportedFluentSdkVersionList()}`,
    );
  }
  return selected;
}

export function fluentManifests(): readonly FluentSdkManifest[] {
  return SUPPORTED_FLUENT_SDK_VERSIONS.map((version) => REGISTRY[version]!);
}
