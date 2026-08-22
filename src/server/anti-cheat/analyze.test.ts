import { describe, expect, it } from "vite-plus/test";
import {
  compareUserPair,
  generateInteractiveDashboard,
  type Cluster,
  type NetworkSummary,
  type UserNode,
} from "../../../scripts/analyze-cheaters";

function createMockUser(overrides: Partial<UserNode> = {}): UserNode {
  return {
    id: overrides.id || "user-" + Math.random().toString(36).slice(2),
    name: overrides.name || "Test Player",
    email: overrides.email || "player@example.com",
    college: overrides.college || "mec",
    collegeOther: overrides.collegeOther || null,
    branch: overrides.branch || "CS",
    batch: overrides.batch || "2027",
    phone: overrides.phone !== undefined ? overrides.phone : "+919876543210",
    trustScore: overrides.trustScore ?? 100,
    role: overrides.role || "player",
    banLevel: overrides.banLevel ?? 0,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    devices: overrides.devices || [
      {
        id: "dev-1",
        deviceHash: "dev-hash-1",
        hardwareHash: "hw-hash-1",
        fpVisitorId: "fp-vis-1",
        canvasHash: "canvas-1",
        webglHash: "webgl-1",
        fontHash: "fonts-1",
        screenHash: "screen-1",
        audioHash: "audio-1",
        localIp: "192.168.1.50",
        lastIp: "103.20.10.5",
        firstIp: "103.20.10.5",
        platform: "Linux x86_64",
        userAgent: "Mozilla/5.0 Chrome/120.0.0.0",
        firstCountry: "IN",
        firstCity: "Kochi",
        lastCountry: "IN",
        lastCity: "Kochi",
        fingerprint: {
          webglRenderer: "NVIDIA GeForce RTX 3060",
          screen: "1920x1080x24@1",
          localIp: "192.168.1.50",
        },
      },
    ],
    attempts: overrides.attempts || [],
    logs: overrides.logs || [],
  };
}

describe("Forensic Cheater Analysis & Link Engine", () => {
  const residentialNet = new Map<string, NetworkSummary>([
    [
      "103.20.10.5",
      {
        ip: "103.20.10.5",
        userCount: 2,
        isCampusOrNat: false,
        colleges: { "Govt Model Engineering College (MEC)": 2 },
      },
    ],
  ]);

  const campusNet = new Map<string, NetworkSummary>([
    [
      "117.200.50.1",
      {
        ip: "117.200.50.1",
        userCount: 45,
        isCampusOrNat: true,
        colleges: { "Govt Model Engineering College (MEC)": 40 },
        primaryCollege: "Govt Model Engineering College (MEC)",
      },
    ],
  ]);

  it("identifies deterministic multi-accounts sharing the exact same phone number", () => {
    const uA = createMockUser({ id: "u1", phone: "+919999988888", devices: [] });
    const uB = createMockUser({ id: "u2", phone: "+919999988888", devices: [] });

    const edge = compareUserPair(uA, uB, residentialNet);
    expect(edge).not.toBeNull();
    expect(edge!.confidence).toBe(100);
    expect(edge!.riskTier).toBe("critical");
    expect(edge!.matchedSignals).toContain("phone");
    expect(edge!.reasons[0]).toContain("Exact Phone Number Match");
  });

  it("identifies deterministic accounts sharing exact device hash", () => {
    const uA = createMockUser({
      id: "u1",
      phone: null,
      devices: [
        {
          id: "dev-a",
          deviceHash: "exact-shared-hash",
          hardwareHash: null,
          fpVisitorId: null,
          canvasHash: null,
          webglHash: null,
          fontHash: null,
          screenHash: null,
          audioHash: null,
          localIp: null,
          lastIp: "1.2.3.4",
          firstIp: "1.2.3.4",
          platform: "Linux",
          userAgent: "Chrome",
          firstCountry: null,
          firstCity: null,
          lastCountry: null,
          lastCity: null,
          fingerprint: null,
        },
      ],
    });

    const uB = createMockUser({
      id: "u2",
      phone: null,
      devices: [
        {
          id: "dev-b",
          deviceHash: "exact-shared-hash",
          hardwareHash: null,
          fpVisitorId: null,
          canvasHash: null,
          webglHash: null,
          fontHash: null,
          screenHash: null,
          audioHash: null,
          localIp: null,
          lastIp: "1.2.3.4",
          firstIp: "1.2.3.4",
          platform: "Linux",
          userAgent: "Chrome",
          firstCountry: null,
          firstCity: null,
          lastCountry: null,
          lastCity: null,
          fingerprint: null,
        },
      ],
    });

    const edge = compareUserPair(uA, uB, residentialNet);
    expect(edge).not.toBeNull();
    expect(edge!.confidence).toBe(100);
    expect(edge!.matchedSignals).toContain("same_device");
  });

  it("flags high confidence for FingerprintJS visitor ID matches across sessions", () => {
    const uA = createMockUser({
      id: "u1",
      phone: null,
      devices: [
        {
          id: "dev-a",
          deviceHash: "hash-1",
          hardwareHash: "hw-1",
          fpVisitorId: "persistent-visitor-xyz",
          canvasHash: null,
          webglHash: null,
          fontHash: null,
          screenHash: null,
          audioHash: null,
          localIp: null,
          lastIp: "50.50.50.50",
          firstIp: null,
          platform: "Android",
          userAgent: "Chrome Mobile",
          firstCountry: null,
          firstCity: null,
          lastCountry: null,
          lastCity: null,
          fingerprint: null,
        },
      ],
    });

    const uB = createMockUser({
      id: "u2",
      phone: null,
      devices: [
        {
          id: "dev-b",
          deviceHash: "hash-2",
          hardwareHash: "hw-1",
          fpVisitorId: "persistent-visitor-xyz",
          canvasHash: null,
          webglHash: null,
          fontHash: null,
          screenHash: null,
          audioHash: null,
          localIp: null,
          lastIp: "50.50.50.50",
          firstIp: null,
          platform: "Android",
          userAgent: "Chrome Mobile",
          firstCountry: null,
          firstCity: null,
          lastCountry: null,
          lastCity: null,
          fingerprint: null,
        },
      ],
    });

    const edge = compareUserPair(uA, uB, residentialNet);
    expect(edge).not.toBeNull();
    expect(edge!.confidence).toBeGreaterThanOrEqual(85);
    expect(edge!.matchedSignals).toContain("fp_visitor");
  });

  it("identifies matching WebRTC Private LAN IP + Public IP as same physical machine", () => {
    const uA = createMockUser({
      id: "u1",
      phone: null,
      devices: [
        {
          id: "dev-a",
          deviceHash: "hash-a",
          hardwareHash: null,
          fpVisitorId: null,
          canvasHash: null,
          webglHash: null,
          fontHash: null,
          screenHash: null,
          audioHash: null,
          localIp: "192.168.1.77",
          lastIp: "103.20.10.5",
          firstIp: "103.20.10.5",
          platform: "Windows",
          userAgent: "Edge",
          firstCountry: null,
          firstCity: null,
          lastCountry: null,
          lastCity: null,
          fingerprint: null,
        },
      ],
    });

    const uB = createMockUser({
      id: "u2",
      phone: null,
      devices: [
        {
          id: "dev-b",
          deviceHash: "hash-b",
          hardwareHash: null,
          fpVisitorId: null,
          canvasHash: null,
          webglHash: null,
          fontHash: null,
          screenHash: null,
          audioHash: null,
          localIp: "192.168.1.77",
          lastIp: "103.20.10.5",
          firstIp: "103.20.10.5",
          platform: "Windows",
          userAgent: "Firefox",
          firstCountry: null,
          firstCity: null,
          lastCountry: null,
          lastCity: null,
          fingerprint: null,
        },
      ],
    });

    const edge = compareUserPair(uA, uB, residentialNet);
    expect(edge).not.toBeNull();
    expect(edge!.confidence).toBeGreaterThanOrEqual(90);
    expect(edge!.matchedSignals).toContain("local_ip_match");
  });

  it("DOES NOT create false positive critical rings for innocent campus peers on shared Wi-Fi", () => {
    // Two students on MEC campus Wi-Fi (117.200.50.1) with distinct devices
    const uA = createMockUser({
      id: "u1",
      phone: "+919876543210",
      devices: [
        {
          id: "dev-a",
          deviceHash: "hash-student-a",
          hardwareHash: "hw-a",
          fpVisitorId: "vis-a",
          canvasHash: "canvas-a",
          webglHash: "webgl-a",
          fontHash: "font-common",
          screenHash: "screen-common",
          audioHash: "audio-a",
          localIp: "10.0.1.12",
          lastIp: "117.200.50.1",
          firstIp: "117.200.50.1",
          platform: "Android",
          userAgent: "Chrome Mobile",
          firstCountry: "IN",
          firstCity: "Kochi",
          lastCountry: "IN",
          lastCity: "Kochi",
          fingerprint: {
            screen: "393x873@2.75",
          },
        },
      ],
    });

    const uB = createMockUser({
      id: "u2",
      phone: "+919123456789",
      devices: [
        {
          id: "dev-b",
          deviceHash: "hash-student-b",
          hardwareHash: "hw-b",
          fpVisitorId: "vis-b",
          canvasHash: "canvas-b",
          webglHash: "webgl-b",
          fontHash: "font-common",
          screenHash: "screen-common",
          audioHash: "audio-b",
          localIp: "10.0.1.88",
          lastIp: "117.200.50.1",
          firstIp: "117.200.50.1",
          platform: "Android",
          userAgent: "Chrome Mobile",
          firstCountry: "IN",
          firstCity: "Kochi",
          lastCountry: "IN",
          lastCity: "Kochi",
          fingerprint: {
            screen: "393x873@2.75",
          },
        },
      ],
    });

    const edge = compareUserPair(uA, uB, campusNet);
    // Captured as a lead with explicit campus false positive warning and NOT marked critical
    expect(edge).not.toBeNull();
    expect(edge!.riskTier).not.toBe("critical");
    expect(edge!.falsePositiveRisk).toBe("medium");
    expect(edge!.matchedSignals).toContain("shared_campus_ip");
  });

  it("DOES NOT flag two distinct players with the same common phone model/GPU (e.g. Mali-G610) on different networks", () => {
    // Aditeya (Mobile IP) and Niranjana (Home Wi-Fi) who both happen to have the same Mali-G610 Android phone
    const uA = createMockUser({
      id: "u_aditeya",
      name: "Aditeya J Frankur",
      email: "aditeyajfrankur@gmail.com",
      college: "mec",
      branch: "cu",
      phone: null,
      devices: [
        {
          id: "dev-aditeya",
          deviceHash: "87cfbb9e3241bcca",
          hardwareHash: "f7af56e50e34c21f",
          fpVisitorId: "d92134fee7add41043cf8279a9373c18",
          canvasHash: "43d9297a6f1d",
          webglHash: "mali_g610_hash",
          fontHash: "font-standard",
          screenHash: "screen-standard",
          audioHash: "audio-android",
          localIp: "192.168.1.9",
          lastIp: "2401:4900:8fdd:656e:6b3a:56bf:f214:a8b6", // Jio Mobile IP
          firstIp: "2401:4900:8fdd:656e:6b3a:56bf:f214:a8b6",
          platform: "Linux armv81",
          userAgent: "Mozilla/5.0 (Linux; Android 14; 23076RN4BI) Chrome/128.0.0.0",
          firstCountry: "IN",
          firstCity: "Kochi",
          lastCountry: "IN",
          lastCity: "Kochi",
          fingerprint: {
            webglRenderer: "ANGLE (ARM, Mali-G610 MC4, OpenGL ES 3.2)",
            screen: "393x873x24@2.75",
            localIp: "192.168.1.9",
          },
        },
      ],
    });

    const uB = createMockUser({
      id: "u_niranjana",
      name: "Niranjana A",
      email: "niranjana6002@gmail.com",
      college: "mec",
      branch: "cs",
      phone: "+918129632745",
      devices: [
        {
          id: "dev-niranjana",
          deviceHash: "bd59ad0b2564c1b1",
          hardwareHash: "f7af56e50e34c21f", // Same hardware composite from common phone model
          fpVisitorId: "118b276adc87cfa4ce4d40e101a15b6e", // Completely different FingerprintJS
          canvasHash: "43d9297a6f1d", // Same standard Android canvas
          webglHash: "mali_g610_hash", // Same Mali-G610
          fontHash: "font-standard",
          screenHash: "screen-standard",
          audioHash: "audio-android",
          localIp: null, // mDNS
          lastIp: "111.92.115.24", // Asianet Broadband IP
          firstIp: "111.92.115.24",
          platform: "Linux armv81",
          userAgent: "Mozilla/5.0 (Linux; Android 14; 23076RN4BI) Chrome/128.0.0.0",
          firstCountry: "IN",
          firstCity: "Kochi",
          lastCountry: "IN",
          lastCity: "Kochi",
          fingerprint: {
            webglRenderer: "ANGLE (ARM, Mali-G610 MC4, OpenGL ES 3.2)",
            screen: "393x873x24@2.75",
            localIp: null,
          },
        },
      ],
    });

    const edge = compareUserPair(
      uA,
      uB,
      new Map([
        [
          "2401:4900:8fdd:656e:6b3a:56bf:f214:a8b6",
          {
            ip: "2401:4900:8fdd:656e:6b3a:56bf:f214:a8b6",
            userCount: 1,
            isCampusOrNat: false,
            colleges: {},
          },
        ],
        [
          "111.92.115.24",
          { ip: "111.92.115.24", userCount: 1, isCampusOrNat: false, colleges: {} },
        ],
      ]),
    );

    // Captured as a Medium/Informational Lead with clear false positive risk notes
    expect(edge).not.toBeNull();
    expect(edge!.riskTier).toBe("medium");
    expect(edge!.falsePositiveRisk).toBe("high");
    expect(edge!.matchedSignals).toContain("hardware_profile_match");
  });

  it("generates rich interactive HTML dashboard embedding all clusters, manual comparator, and metadata", () => {
    const mockCluster: Cluster = {
      id: 1,
      users: [
        createMockUser({ id: "u1", name: "Alice", email: "alice@mec.ac.in" }),
        createMockUser({ id: "u2", name: "Bob", email: "bob@mec.ac.in" }),
      ],
      maxConfidence: 95,
      primaryClassification: "PROBABLE_MULTI_ACCOUNT",
      riskTier: "critical",
      edges: [
        {
          userAId: "u1",
          userBId: "u2",
          confidence: 95,
          riskTier: "critical",
          matchedSignals: ["same_device", "fp_visitor"],
          reasons: ["Exact shared persistent device hash"],
          falsePositiveRisk: "none",
          falsePositiveNotes: [],
          signalDiffs: [
            {
              name: "Device ID Hash",
              category: "identity",
              valA: "hash123",
              valB: "hash123",
              isMatch: true,
              isDifferent: false,
              entropyWeight: 95,
            },
          ],
        },
      ],
      warnings: [],
    };

    const html = generateInteractiveDashboard(
      [mockCluster],
      mockCluster.users,
      [],
      new Map([["1.2.3.4", { ip: "1.2.3.4", userCount: 2, isCampusOrNat: false, colleges: {} }]]),
    );

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("FOSS Onam Anti-Cheat Intelligence");
    expect(html).toContain("analysis-data");
    expect(html).toContain("openModal");
    expect(html).toContain("renderModalDiff");
    expect(html).toContain("exportReportJson");
    expect(html).toContain("alice@mec.ac.in");
  });
});
