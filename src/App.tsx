import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  ArrowUpDown,
  Crown,
  Filter,
  Lock,
  Palette,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";

// --- Types ---
type Department =
  | "LSPD"
  | "SAHP"
  | "BCSO"
  | "CIV"
  | "Fire Rescue"
  | "Communications"
  | "Internal Affairs"
  | "Media Division"
  | "Development";

type CommunityRank =
  | "Recruit"
  | "Member"
  | "Staff-In-Training"
  | "Staff"
  | "Senior Staff"
  | "Junior Administration"
  | "Administration"
  | "Senior Administration"
  | "Head Admin";

type PermissionGroup =
  | "Member"
  | "StaffInTraining"
  | "Staff"
  | "Administration"
  | "HeadAdministration";

type RemovalReasonType =
  | "Discipline"
  | "Proper Resignation"
  | "Improper Resignation"
  | "Retirement"
  | "Inactive Removal"
  | "Other";

type TransferReasonType =
  | "Career Progression"
  | "Department Needs"
  | "Performance Review"
  | "Disciplinary"
  | "Personal"
  | "Other";

type SortKey =
  | "communityNumber"
  | "unitNumber"
  | "name"
  | "department"
  | "rank"
  | "communityRank"
  | "status";

interface Member {
  id: string;
  name: string;
  communityId: string; // SRP-#### derived from communityNumber
  communityNumber: string; // 4-digit, non-editable
  unitNumber: string; // editable
  department: Department;
  rank: string;
  communityRank: CommunityRank;
  subdivisions: string;
  status: string;
  // activity tracking
  currentMonthHours: number;
  lastPatrolDate?: string;
  // sensitive (Staff-In-Training+ view)
  discordId?: string;
  websiteLink?: string;
  teamspeakUid?: string;
}

interface ArchivedMember extends Member {
  dischargeReason: RemovalReasonType;
  dischargeDetail: string;
  dischargeDate: string;
}

interface PermissionConfig {
  // roster operations
  canAddMembers: boolean;
  canEditMembers: boolean;
  canRemoveMembers: boolean;
  canMoveWithinDept: boolean;
  canTransferDepts: boolean;

  // governance
  canManageRanks: boolean;
  canManagePermissions: boolean;
  canManageUsers: boolean;
  canAccessArchive: boolean;
  canManageSettings: boolean; // head admin configuration
}

interface RankMeta {
  label: string;
  color: string; // hex
}

interface DeptRankDef {
  id: string;
  name: string;
  color: string; // hex
}

interface StatusDef {
  id: string;
  name: string;
  color: string; // hex
}

interface AuthSettings {
  requireLoginForAdmin: boolean;
  allowInviteSignup: boolean;
  inviteCode: string;
  disableAccountOnDischarge: boolean;
  communityRankToGroup: Record<CommunityRank, PermissionGroup>;
}

interface RosterSettings {
  theme: "dark" | "midnight" | "blue" | "crimson" | "emerald" | "sunset" | "ocean";
  customPrimaryColor: string;
  departments: Department[];
  communityRanks: CommunityRank[];

  // visual controls
  communityRankMeta: Record<CommunityRank, RankMeta>;
  departmentRankCatalog: Record<Department, DeptRankDef[]>;
  statusCatalog: StatusDef[];

  // patrol / activity settings
  patrolFormUrl: string;
  departmentRequirements: Record<Department, number>;

  permissions: Record<PermissionGroup, PermissionConfig>;

  auth: AuthSettings;
}

interface RemovalLog {
  id: string;
  name: string;
  communityNumber: string;
  department: Department;
  reason: RemovalReasonType;
  detail: string;
  date: string;
}

interface TransferLog {
  id: string;
  name: string;
  communityNumber: string;
  from: Department;
  to: Department;
  reason: TransferReasonType;
  detail: string;
  date: string;
}

interface Account {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  enabled: boolean;
  linkedCommunityNumber?: string; // links to Member.communityNumber
  roleOverride?: PermissionGroup; // optional override
  createdAt: string;
  lastLoginAt?: string;
}

interface Session {
  accountId: string;
  createdAt: string;
}

// --- Constants ---
const DEPARTMENTS: Department[] = [
  "LSPD",
  "SAHP",
  "BCSO",
  "CIV",
  "Fire Rescue",
  "Communications",
  "Internal Affairs",
  "Media Division",
  "Development",
];

const COMMUNITY_RANKS: CommunityRank[] = [
  "Recruit",
  "Member",
  "Staff-In-Training",
  "Staff",
  "Senior Staff",
  "Junior Administration",
  "Administration",
  "Senior Administration",
  "Head Admin",
];

const PERMISSION_GROUPS: PermissionGroup[] = [
  "Member",
  "StaffInTraining",
  "Staff",
  "Administration",
  "HeadAdministration",
];

const DEFAULT_PERMISSIONS: Record<PermissionGroup, PermissionConfig> = {
  Member: {
    canAddMembers: false,
    canEditMembers: false,
    canRemoveMembers: false,
    canMoveWithinDept: false,
    canTransferDepts: false,
    canManageRanks: false,
    canManagePermissions: false,
    canManageUsers: false,
    canAccessArchive: false,
    canManageSettings: false,
  },
  StaffInTraining: {
    canAddMembers: true,
    canEditMembers: true,
    canRemoveMembers: false,
    canMoveWithinDept: true,
    canTransferDepts: false,
    canManageRanks: false,
    canManagePermissions: false,
    canManageUsers: false,
    canAccessArchive: false,
    canManageSettings: false,
  },
  Staff: {
    canAddMembers: true,
    canEditMembers: true,
    canRemoveMembers: true,
    canMoveWithinDept: true,
    canTransferDepts: true,
    canManageRanks: false,
    canManagePermissions: false,
    canManageUsers: false,
    canAccessArchive: true,
    canManageSettings: false,
  },
  Administration: {
    canAddMembers: true,
    canEditMembers: true,
    canRemoveMembers: true,
    canMoveWithinDept: true,
    canTransferDepts: true,
    canManageRanks: true,
    // intentionally false: Head Admin controls permission governance
    canManagePermissions: false,
    canManageUsers: true,
    canAccessArchive: true,
    canManageSettings: false,
  },
  HeadAdministration: {
    canAddMembers: true,
    canEditMembers: true,
    canRemoveMembers: true,
    canMoveWithinDept: true,
    canTransferDepts: true,
    canManageRanks: true,
    canManagePermissions: true,
    canManageUsers: true,
    canAccessArchive: true,
    canManageSettings: true,
  },
};

function defaultCommunityRankMeta(): Record<CommunityRank, RankMeta> {
  const base: Partial<Record<CommunityRank, RankMeta>> = {};
  for (const r of COMMUNITY_RANKS) {
    const idx = COMMUNITY_RANKS.indexOf(r);
    const color = idx >= 6 ? "#a855f7" : idx >= 3 ? "#3b82f6" : "#64748b";
    base[r] = { label: r, color };
  }
  return base as Record<CommunityRank, RankMeta>;
}

function defaultCommunityRankToGroup(): Record<CommunityRank, PermissionGroup> {
  return {
    Recruit: "Member",
    Member: "Member",
    "Staff-In-Training": "StaffInTraining",
    Staff: "Staff",
    "Senior Staff": "Staff",
    "Junior Administration": "Administration",
    Administration: "Administration",
    "Senior Administration": "Administration",
    "Head Admin": "HeadAdministration",
  };
}

function defaultDepartmentRankCatalog(): Record<Department, DeptRankDef[]> {
  const mk = (names: { name: string; color: string }[]) =>
    names.map((n) => ({ id: cryptoId(), name: n.name, color: n.color }));

  return {
    LSPD: mk([
      { name: "Recruit", color: "#94a3b8" },
      { name: "Officer I", color: "#60a5fa" },
      { name: "Sergeant", color: "#f59e0b" },
      { name: "Captain", color: "#a78bfa" },
      { name: "Chief of Police", color: "#f87171" },
    ]),
    SAHP: mk([
      { name: "Trooper", color: "#94a3b8" },
      { name: "Corporal", color: "#60a5fa" },
      { name: "Sergeant", color: "#f59e0b" },
      { name: "Captain", color: "#a78bfa" },
      { name: "Commissioner", color: "#f87171" },
    ]),
    BCSO: mk([
      { name: "Deputy", color: "#94a3b8" },
      { name: "Corporal", color: "#60a5fa" },
      { name: "Sergeant", color: "#f59e0b" },
      { name: "Captain", color: "#a78bfa" },
      { name: "Sheriff", color: "#f87171" },
    ]),
    CIV: mk([
      { name: "Civilian", color: "#34d399" },
      { name: "Business Owner", color: "#60a5fa" },
      { name: "Gang Affiliated", color: "#f87171" },
    ]),
    "Fire Rescue": mk([
      { name: "Firefighter", color: "#fca5a5" },
      { name: "Paramedic", color: "#fde68a" },
      { name: "Lieutenant", color: "#93c5fd" },
      { name: "Battalion Chief", color: "#f87171" },
    ]),
    Communications: mk([
      { name: "Dispatcher", color: "#818cf8" },
      { name: "Lead Dispatcher", color: "#60a5fa" },
    ]),
    "Internal Affairs": mk([
      { name: "Investigator", color: "#c084fc" },
      { name: "Senior Investigator", color: "#a78bfa" },
    ]),
    "Media Division": mk([
      { name: "Reporter", color: "#fb7185" },
      { name: "Photographer", color: "#f472b6" },
    ]),
    Development: mk([
      { name: "Developer", color: "#fb923c" },
      { name: "Lead Developer", color: "#f97316" },
    ]),
  };
}

function defaultStatusCatalog(): StatusDef[] {
  return [
    { id: cryptoId(), name: "Active", color: "#10b981" },
    { id: cryptoId(), name: "Inactive", color: "#94a3b8" },
    { id: cryptoId(), name: "LOA", color: "#f59e0b" },
    { id: cryptoId(), name: "Reserve", color: "#94a3b8" },
    { id: cryptoId(), name: "Training", color: "#60a5fa" },
    { id: cryptoId(), name: "Suspended", color: "#ef4444" },
  ];
}

// --- Initial Data ---
const INITIAL_MEMBERS: Member[] = [
  {
    id: "1",
    name: "John Doe",
    communityId: "SRP-4521",
    communityNumber: "4521",
    unitNumber: "2L-15",
    department: "LSPD",
    rank: "Chief of Police",
    communityRank: "Head Admin",
    subdivisions: "Command Staff",
    status: "Active",
    currentMonthHours: 12.5,
    lastPatrolDate: "2023-10-25",
    discordId: "123456789",
    websiteLink: "https://scenicrp.com",
    teamspeakUid: "TS-ABC-123",
  },
  {
    id: "2",
    name: "Jane Smith",
    communityId: "SRP-7832",
    communityNumber: "7832",
    unitNumber: "2L-42",
    department: "LSPD",
    rank: "Captain",
    communityRank: "Senior Administration",
    subdivisions: "Traffic, Training",
    status: "Active",
    currentMonthHours: 4.0,
    discordId: "987654321",
  },
];

// --- Helpers ---
function cryptoId() {
  const anyCrypto = globalThis.crypto as Crypto | undefined;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  return Math.random().toString(36).slice(2, 10);
}

function compareString(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function toHexAlpha(hex: string, alpha01: number) {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return hex;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha01})`;
}

function bytesToHex(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

async function hashPassword(password: string) {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(digest);
}

function useLocalStorageState<T>(key: string, initialValue: T | (() => T)) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch {
      // ignore
    }
    return typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [key, state]);

  return [state, setState] as const;
}

function isStaffPlus(rank: CommunityRank) {
  return COMMUNITY_RANKS.indexOf(rank) >= COMMUNITY_RANKS.indexOf("Staff");
}

export function App() {
  // Persist core data locally so accounts / promotions remain consistent
  const [members, setMembers] = useLocalStorageState<Member[]>("srp_members", INITIAL_MEMBERS);
  const [archivedMembers, setArchivedMembers] = useLocalStorageState<ArchivedMember[]>("srp_archivedMembers", []);
  const [removalLogs, setRemovalLogs] = useLocalStorageState<RemovalLog[]>("srp_removalLogs", []);
  const [transferLogs, setTransferLogs] = useLocalStorageState<TransferLog[]>("srp_transferLogs", []);

  const [settings, setSettings] = useLocalStorageState<RosterSettings>("srp_settings", () => ({
    theme: "midnight",
    customPrimaryColor: "#2563eb",
    departments: DEPARTMENTS,
    communityRanks: COMMUNITY_RANKS,
    communityRankMeta: defaultCommunityRankMeta(),
    departmentRankCatalog: defaultDepartmentRankCatalog(),
    statusCatalog: defaultStatusCatalog(),
    patrolFormUrl: "",
    departmentRequirements: DEPARTMENTS.reduce((acc, d) => ({ ...acc, [d]: 4 }), {} as Record<Department, number>),
    permissions: DEFAULT_PERMISSIONS,
    auth: {
      requireLoginForAdmin: true,
      allowInviteSignup: false,
      inviteCode: "",
      disableAccountOnDischarge: true,
      communityRankToGroup: defaultCommunityRankToGroup(),
    },
  }));

  const [accounts, setAccounts] = useLocalStorageState<Account[]>("srp_accounts", []);
  const [session, setSession] = useLocalStorageState<Session | null>("srp_session", null);

  // Seed a bootstrap Director account on first run
  useEffect(() => {
    if (accounts.length > 0) return;
    (async () => {
      const directorPwdHash = await hashPassword("scenicrp");
      const seeded: Account = {
        id: cryptoId(),
        email: "director@scenicrp.local",
        displayName: "Director",
        passwordHash: directorPwdHash,
        enabled: true,
        linkedCommunityNumber: "4521",
        createdAt: new Date().toISOString(),
      };
      setAccounts([seeded]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [view, setView] = useState<"public" | "admin">("public");
  const [activeTab, setActiveTab] = useState<Department | "All" | "Staff+">("All");
  const [search, setSearch] = useState("");

  // sort / filters
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState({
    communityNumber: "",
    unitNumber: "",
    name: "",
    department: "",
    rank: "",
    communityRank: "",
    status: "",
    subdivisions: "",
  });

  // modals / panels
  const [isAdding, setIsAdding] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showPatrolMgr, setShowPatrolMgr] = useState(false);
  const [transferringMember, setTransferringMember] = useState<Member | null>(null);
  const [removingMember, setRemovingMember] = useState<Member | null>(null);

  // --- Auth resolution ---
  const currentAccount = useMemo(() => {
    if (!session) return null;
    return accounts.find((a) => a.id === session.accountId) ?? null;
  }, [accounts, session]);

  const linkedMember = useMemo(() => {
    if (!currentAccount?.linkedCommunityNumber) return null;
    return members.find((m) => m.communityNumber === currentAccount.linkedCommunityNumber) ?? null;
  }, [currentAccount, members]);

  const effectivePermissionGroup: PermissionGroup = useMemo(() => {
    if (!currentAccount) return "Member";
    if (!currentAccount.enabled) return "Member";
    if (currentAccount.roleOverride) return currentAccount.roleOverride;
    if (linkedMember) return settings.auth.communityRankToGroup[linkedMember.communityRank];
    return "Member";
  }, [currentAccount, linkedMember, settings.auth.communityRankToGroup]);

  const userPerms = settings.permissions[effectivePermissionGroup];
  const isAuthed = Boolean(currentAccount && currentAccount.enabled);
  const isAuthedAdmin = isAuthed && effectivePermissionGroup !== "Member";

  const canViewSensitive = view === "admin" && isAuthedAdmin && userPerms.canEditMembers;

  // --- rank self-limit (prevents staff from setting ranks above themselves) ---
  const selfCommunityRankIndex = linkedMember ? COMMUNITY_RANKS.indexOf(linkedMember.communityRank) : -1;
  const maxAssignableCommunityRankIndex = effectivePermissionGroup === "HeadAdministration" ? COMMUNITY_RANKS.length - 1 : selfCommunityRankIndex;
  const allowedCommunityRanks = COMMUNITY_RANKS.filter((r) => COMMUNITY_RANKS.indexOf(r) <= maxAssignableCommunityRankIndex);

  // Logic: Community ID Generation
  const generateCID = () => {
    let num: string;
    const existing = new Set(members.map((m) => m.communityNumber));
    do {
      num = Math.floor(1000 + Math.random() * 9000).toString();
    } while (existing.has(num));
    return num;
  };

  const statusNames = useMemo(() => settings.statusCatalog.map((s) => s.name), [settings.statusCatalog]);

  // Derived lists
  const filteredMembers = useMemo(() => {
    const tabFiltered = members.filter((m) => {
      let matchesTab = true;
      if (activeTab === "Staff+") {
        matchesTab = isStaffPlus(m.communityRank);
      } else if (activeTab !== "All") {
        matchesTab = m.department === activeTab;
      }

      const matchesSearch =
        search.trim() === "" ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.communityNumber.includes(search) ||
        m.unitNumber.toLowerCase().includes(search.toLowerCase());

      const f = filters;
      const matchesFilters =
        (f.communityNumber.trim() === "" || m.communityNumber.includes(f.communityNumber.trim())) &&
        (f.unitNumber.trim() === "" || m.unitNumber.toLowerCase().includes(f.unitNumber.trim().toLowerCase())) &&
        (f.name.trim() === "" || m.name.toLowerCase().includes(f.name.trim().toLowerCase())) &&
        (f.department.trim() === "" || m.department === (f.department as Department)) &&
        (f.rank.trim() === "" || m.rank.toLowerCase().includes(f.rank.trim().toLowerCase())) &&
        (f.communityRank.trim() === "" || m.communityRank === (f.communityRank as CommunityRank)) &&
        (f.status.trim() === "" || m.status === f.status) &&
        (f.subdivisions.trim() === "" || m.subdivisions.toLowerCase().includes(f.subdivisions.trim().toLowerCase()));

      return matchesTab && matchesSearch && matchesFilters;
    });

    const defaultCompare = (a: Member, b: Member) => {
      const ra = COMMUNITY_RANKS.indexOf(a.communityRank);
      const rb = COMMUNITY_RANKS.indexOf(b.communityRank);
      if (ra !== rb) return rb - ra;
      const d = compareString(a.department, b.department);
      if (d !== 0) return d;
      return compareString(a.name, b.name);
    };

    const customCompare = (a: Member, b: Member) => {
      if (!sortKey) return defaultCompare(a, b);
      const dirMul = sortDir === "asc" ? 1 : -1;

      const val = (m: Member): string | number => {
        switch (sortKey) {
          case "communityNumber":
            return Number(m.communityNumber);
          case "unitNumber":
            return m.unitNumber;
          case "name":
            return m.name;
          case "department":
            return m.department;
          case "rank":
            return m.rank;
          case "communityRank":
            return COMMUNITY_RANKS.indexOf(m.communityRank);
          case "status":
            return m.status;
          default:
            return "";
        }
      };

      const av = val(a);
      const bv = val(b);
      if (typeof av === "number" && typeof bv === "number") {
        if (av === bv) return defaultCompare(a, b);
        return (av - bv) * dirMul;
      }
      const s = compareString(String(av), String(bv));
      if (s === 0) return defaultCompare(a, b);
      return s * dirMul;
    };

    return [...tabFiltered].sort(customCompare);
  }, [members, activeTab, search, filters, sortKey, sortDir]);

  // --- Actions ---
  const handleAddMember = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const cidNum = generateCID();
    const newMember: Member = {
      id: cryptoId(),
      name: String(data.get("name") || "").trim(),
      communityNumber: cidNum,
      communityId: `SRP-${cidNum}`,
      unitNumber: String(data.get("unitNumber") || "").trim(),
      department: data.get("department") as Department,
      rank: String(data.get("rank") || "").trim(),
      communityRank: data.get("communityRank") as CommunityRank,
      subdivisions: String(data.get("subdivisions") || "").trim(),
      status: (data.get("status") as string) || "Active",
      currentMonthHours: 0,
      discordId: String(data.get("discordId") || "").trim() || undefined,
      websiteLink: String(data.get("websiteLink") || "").trim() || undefined,
      teamspeakUid: String(data.get("teamspeakUid") || "").trim() || undefined,
    };
    setMembers((prev) => [...prev, newMember]);
    setIsAdding(false);
    e.currentTarget.reset();
  };

  const handleEditMember = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingMember) return;

    const data = new FormData(e.currentTarget);
    const desiredCommunityRank = data.get("communityRank") as CommunityRank;
    if (COMMUNITY_RANKS.indexOf(desiredCommunityRank) > maxAssignableCommunityRankIndex) {
      alert("You cannot set a Community Rank higher than your own.");
      return;
    }

    const updated: Member = {
      ...editingMember,
      name: String(data.get("name") || "").trim(),
      unitNumber: String(data.get("unitNumber") || "").trim(),
      department: data.get("department") as Department,
      rank: String(data.get("rank") || "").trim(),
      communityRank: desiredCommunityRank,
      subdivisions: String(data.get("subdivisions") || "").trim(),
      status: String(data.get("status") || "").trim(),
      discordId: String(data.get("discordId") || "").trim() || undefined,
      websiteLink: String(data.get("websiteLink") || "").trim() || undefined,
      teamspeakUid: String(data.get("teamspeakUid") || "").trim() || undefined,
    };
    setMembers((prev) => prev.map((m) => (m.id === editingMember.id ? updated : m)));
    setEditingMember(null);
  };

  const processTransfer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!transferringMember) return;
    const data = new FormData(e.currentTarget);
    const toDept = data.get("toDept") as Department;

    const desiredCommunityRank = data.get("communityRank") as CommunityRank;
    if (COMMUNITY_RANKS.indexOf(desiredCommunityRank) > maxAssignableCommunityRankIndex) {
      alert("You cannot set a Community Rank higher than your own.");
      return;
    }

    setTransferLogs((prev) => [
      ...prev,
      {
        id: cryptoId(),
        name: transferringMember.name,
        communityNumber: transferringMember.communityNumber,
        from: transferringMember.department,
        to: toDept,
        reason: data.get("reason") as TransferReasonType,
        detail: String(data.get("detail") || ""),
        date: new Date().toLocaleDateString(),
      },
    ]);

    setMembers((prev) =>
      prev.map((m) =>
        m.id === transferringMember.id
          ? {
              ...m,
              department: toDept,
              rank: String(data.get("rank") || "").trim(),
              communityRank: desiredCommunityRank,
              unitNumber: String(data.get("unitNumber") || "").trim(),
              subdivisions: String(data.get("subdivisions") || "").trim(),
              status: String(data.get("status") || "").trim(),
            }
          : m
      )
    );

    setTransferringMember(null);
  };

  const processRemoval = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!removingMember) return;
    const data = new FormData(e.currentTarget);
    const reason = data.get("reason") as RemovalReasonType;
    const detail = String(data.get("detail") || "");

    const removalLog: RemovalLog = {
      id: cryptoId(),
      name: removingMember.name,
      communityNumber: removingMember.communityNumber,
      department: removingMember.department,
      reason,
      detail,
      date: new Date().toLocaleDateString(),
    };

    const archived: ArchivedMember = {
      ...removingMember,
      dischargeReason: reason,
      dischargeDetail: detail,
      dischargeDate: new Date().toLocaleDateString(),
    };

    setRemovalLogs((prev) => [...prev, removalLog]);
    setArchivedMembers((prev) => [...prev, archived]);
    setMembers((prev) => prev.filter((m) => m.id !== removingMember.id));

    if (settings.auth.disableAccountOnDischarge) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.linkedCommunityNumber === removingMember.communityNumber ? { ...a, enabled: false } : a
        )
      );
    }

    setRemovingMember(null);
  };

  const restoreFromArchive = (archived: ArchivedMember) => {
    const { dischargeReason: _dr, dischargeDetail: _dd, dischargeDate: _dt, ...member } = archived;
    setMembers((prev) => [...prev, member]);
    setArchivedMembers((prev) => prev.filter((m) => m.id !== archived.id));

    // optional: re-enable linked account if it exists
    setAccounts((prev) => prev.map((a) => (a.linkedCommunityNumber === member.communityNumber ? { ...a, enabled: true } : a)));
  };

  // --- Visual lookup helpers ---
  const getCommunityRankBadgeStyle = (rank: CommunityRank) => {
    const meta = settings.communityRankMeta[rank];
    return {
      backgroundColor: toHexAlpha(meta.color, 0.12),
      borderColor: toHexAlpha(meta.color, 0.25),
      color: meta.color,
    };
  };

  const getDepartmentRankColor = (dept: Department, rankName: string) => {
    const def = settings.departmentRankCatalog[dept]?.find((d) => d.name.toLowerCase() === rankName.toLowerCase());
    return def?.color;
  };

  const getStatusDef = (statusName: string) => settings.statusCatalog.find((s) => s.name === statusName);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const clearFilters = () =>
    setFilters({
      communityNumber: "",
      unitNumber: "",
      name: "",
      department: "",
      rank: "",
      communityRank: "",
      status: "",
      subdivisions: "",
    });

  // --- Auth UX ---
  const requestAdminView = () => {
    setView("admin");
  };

  const logout = () => {
    setSession(null);
    setView("public");
  };

  const requiresAuthGate = view === "admin" && settings.auth.requireLoginForAdmin && !isAuthedAdmin;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" style={{ color: settings.customPrimaryColor }} />
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">SCENIC ROLEPLAY</h1>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Community Roster</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {settings.patrolFormUrl && (
              <a
                href={settings.patrolFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-white hover:bg-slate-700 transition-colors"
              >
                Submit Patrol Log
              </a>
            )}

            <div className="hidden md:flex bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 items-center gap-2 w-72">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                placeholder="Search CID / Unit / Name…"
                className="bg-transparent border-none outline-none text-xs w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                showFilters
                  ? "bg-slate-950 border-slate-700 text-white"
                  : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
              title="Column filters"
            >
              <Filter className="w-4 h-4" />
              Filters
              {(Object.values(filters).some((v) => v.trim() !== "") && (
                <span className="ml-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Active
                </span>
              )) || <span className="text-[10px] text-slate-600">Off</span>}
            </button>

            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setView("public")}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                  view === "public" ? "text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                }`}
                style={view === "public" ? { backgroundColor: settings.customPrimaryColor } : undefined}
              >
                PUBLIC
              </button>
              <button
                onClick={requestAdminView}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                  view === "admin" ? "text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                }`}
                style={view === "admin" ? { backgroundColor: settings.customPrimaryColor } : undefined}
              >
                ADMIN
              </button>
            </div>

            {view === "admin" && isAuthed && (
              <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950">
                <div className="text-[10px]">
                  <div className="text-slate-400 font-bold">Signed in</div>
                  <div className="text-white font-bold">{currentAccount?.email}</div>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div className="text-[10px]">
                  <div className="text-slate-400 font-bold">Auth Group</div>
                  <div className="text-emerald-400 font-bold">{effectivePermissionGroup}</div>
                </div>
                <button
                  onClick={logout}
                  className="text-[10px] font-bold text-slate-400 hover:text-white border border-slate-800 px-2 py-1 rounded-md"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Admin Quick Settings Bar */}
      {view === "admin" && isAuthedAdmin && (
        <div className="border-b border-slate-800 py-2" style={{ backgroundColor: toHexAlpha(settings.customPrimaryColor, 0.06) }}>
          <div className="max-w-[1600px] mx-auto px-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: settings.customPrimaryColor }}>
                Admin Controls:
              </span>

              {userPerms.canAddMembers && (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Register Personnel
                </button>
              )}

              {(userPerms.canManageSettings || userPerms.canManagePermissions || userPerms.canManageUsers) && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" /> System Settings
                </button>
              )}

              {userPerms.canAccessArchive && (
                <button
                  onClick={() => setShowArchive(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
                >
                  <Users className="w-3.5 h-3.5" /> Discharge Archive
                </button>
              )}

              {userPerms.canEditMembers && (
                <button
                  onClick={() => setShowPatrolMgr(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 rotate-45" /> Patrol & Activity
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase">User:</span>
              <span className="text-[10px] font-mono text-slate-300">{currentAccount?.email}</span>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto p-4">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-3">
          <TabButton active={activeTab === "All"} onClick={() => setActiveTab("All")}>All Personnel</TabButton>
          <TabButton active={activeTab === "Staff+"} onClick={() => setActiveTab("Staff+")} color="purple">
            <Crown className="w-3 h-3" /> Staff+
          </TabButton>
          <div className="w-px h-6 bg-slate-800 mx-1" />
          {DEPARTMENTS.map((dept) => (
            <TabButton key={dept} active={activeTab === dept} onClick={() => setActiveTab(dept)}>
              {dept}
            </TabButton>
          ))}
        </div>

        {/* Filters Bar */}
        {showFilters && (
          <div className="mb-4 bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-xs font-bold text-slate-300">Column Filters & Sorting</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSortKey(null);
                    setSortDir("asc");
                  }}
                  className="px-2 py-1 rounded-lg border border-slate-800 bg-slate-950 text-[11px] font-bold text-slate-400 hover:text-white"
                >
                  Reset Sort
                </button>
                <button
                  onClick={clearFilters}
                  className="px-2 py-1 rounded-lg border border-slate-800 bg-slate-950 text-[11px] font-bold text-slate-400 hover:text-white"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FilterField label="CID" value={filters.communityNumber} onChange={(v) => setFilters((p) => ({ ...p, communityNumber: v }))} placeholder="4521" />
              <FilterField label="Unit" value={filters.unitNumber} onChange={(v) => setFilters((p) => ({ ...p, unitNumber: v }))} placeholder="2L-15" />
              <FilterField label="Name" value={filters.name} onChange={(v) => setFilters((p) => ({ ...p, name: v }))} placeholder="John" />

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Department</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs outline-none"
                  value={filters.department}
                  onChange={(e) => setFilters((p) => ({ ...p, department: e.target.value }))}
                >
                  <option value="">All</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <FilterField label="Dept Rank" value={filters.rank} onChange={(v) => setFilters((p) => ({ ...p, rank: v }))} placeholder="Sergeant" />

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Comm Rank</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs outline-none"
                  value={filters.communityRank}
                  onChange={(e) => setFilters((p) => ({ ...p, communityRank: e.target.value }))}
                >
                  <option value="">All</option>
                  {COMMUNITY_RANKS.map((r) => (
                    <option key={r} value={r}>
                      {settings.communityRankMeta[r]?.label ?? r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Status</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs outline-none"
                  value={filters.status}
                  onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="">All</option>
                  {statusNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <FilterField label="Subdivisions" value={filters.subdivisions} onChange={(v) => setFilters((p) => ({ ...p, subdivisions: v }))} placeholder="Traffic" />
            </div>
          </div>
        )}

        {/* The Roster Sheet */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                  <SortableTh label="CID" active={sortKey === "communityNumber"} onClick={() => toggleSort("communityNumber")} />
                  <SortableTh label="Unit" active={sortKey === "unitNumber"} onClick={() => toggleSort("unitNumber")} />
                  <SortableTh label="Name" active={sortKey === "name"} onClick={() => toggleSort("name")} className="min-w-[180px]" />
                  <SortableTh label="Department" active={sortKey === "department"} onClick={() => toggleSort("department")} className="min-w-[140px]" />
                  <SortableTh label="Rank" active={sortKey === "rank"} onClick={() => toggleSort("rank")} className="min-w-[160px]" />
                  <SortableTh label="Comm Rank" active={sortKey === "communityRank"} onClick={() => toggleSort("communityRank")} className="min-w-[170px]" />
                  <th className="px-4 py-3">Subdivisions</th>
                  <th className="px-4 py-3 text-right">Hrs</th>
                  <SortableTh label="Status" active={sortKey === "status"} onClick={() => toggleSort("status")} className="w-28" />
                  {canViewSensitive && <th className="px-4 py-3 min-w-[200px]">Sensitive</th>}
                  {view === "admin" && isAuthedAdmin && <th className="px-4 py-3 w-32 text-center">Manage</th>}
                </tr>
                {sortKey && (
                  <tr className="bg-slate-950 border-b border-slate-800">
                    <td colSpan={canViewSensitive ? 10 : 9} className="px-4 py-2 text-[10px] text-slate-600">
                      Sorting by <span className="text-slate-300 font-bold">{sortKey}</span> ({sortDir})
                    </td>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredMembers.map((m) => {
                  const deptRankColor = getDepartmentRankColor(m.department, m.rank);
                  const statusDef = getStatusDef(m.status);

                  return (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors text-xs group">
                      <td className="px-4 py-2 font-mono text-amber-500 font-bold">{m.communityNumber}</td>
                      <td className="px-4 py-2 font-mono font-bold" style={{ color: settings.customPrimaryColor }}>
                        {m.unitNumber || "—"}
                      </td>
                      <td className="px-4 py-2 font-bold text-slate-200">{m.name}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getDeptStyle(m.department)}`}>{m.department}</span>
                      </td>
                      <td className="px-4 py-2" style={deptRankColor ? { color: deptRankColor } : undefined}>
                        {m.rank}
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold border shadow-sm" style={getCommunityRankBadgeStyle(m.communityRank)}>
                          {settings.communityRankMeta[m.communityRank]?.label ?? m.communityRank}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500 italic text-[11px]">{m.subdivisions || "None"}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-400 font-bold">{m.currentMonthHours.toFixed(1)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: statusDef?.color ?? "#64748b",
                              boxShadow: statusDef?.name === "Active" ? `0 0 8px ${toHexAlpha(statusDef.color, 0.4)}` : undefined,
                            }}
                          />
                          <span className="font-bold text-[10px]" style={statusDef?.color ? { color: statusDef.color } : undefined}>
                            {m.status}
                          </span>
                        </div>
                      </td>

                      {canViewSensitive && (
                        <td className="px-4 py-2 text-[10px] text-slate-500">
                          {m.discordId && <div className="text-indigo-400 font-mono">Discord: {m.discordId}</div>}
                          {m.teamspeakUid && <div className="text-blue-400 font-mono">TS: {m.teamspeakUid}</div>}
                          {m.websiteLink && <div className="text-emerald-400 font-mono truncate max-w-[220px]">Web: {m.websiteLink}</div>}
                        </td>
                      )}

                      {view === "admin" && isAuthedAdmin && (
                        <td className="px-4 py-2">
                          <div className="flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {userPerms.canEditMembers && (
                              <button
                                onClick={() => setEditingMember(m)}
                                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 transition-colors"
                                title="Edit Info"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {userPerms.canTransferDepts && (
                              <button
                                onClick={() => setTransferringMember(m)}
                                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400 transition-colors"
                                title="Transfer / Update"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {userPerms.canRemoveMembers && (
                              <button
                                onClick={() => setRemovingMember(m)}
                                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors"
                                title="Discharge Member"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={view === "admin" && isAuthedAdmin ? (canViewSensitive ? 10 : 9) : canViewSensitive ? 9 : 8} className="py-20 text-center text-slate-500 font-bold italic uppercase tracking-widest">
                      No personnel found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Auth Gate */}
      {requiresAuthGate && (
        <AuthGate
          primaryColor={settings.customPrimaryColor}
          accounts={accounts}
          setAccounts={setAccounts}
          setSession={setSession}
          settings={settings}
          members={members}
          onClose={() => setView("public")}
        />
      )}

      {/* --- MODALS --- */}

      {/* Add Member Modal */}
      {isAdding && isAuthedAdmin && userPerms.canAddMembers && (
        <ModalShell title="Register New Personnel" icon={<Plus className="w-4 h-4" style={{ color: settings.customPrimaryColor }} />} onClose={() => setIsAdding(false)}>
          <form onSubmit={handleAddMember} className="p-4 overflow-y-auto grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Full Name</label>
              <input required name="name" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-600 transition-colors" placeholder="e.g. John Doe" />
            </div>
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Community ID (Auto)</label>
              <div className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-600 font-mono">SRP-####</div>
            </div>
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Unit Number</label>
              <input name="unitNumber" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-600 transition-colors" placeholder="e.g. 2L-01" />
            </div>
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Department</label>
              <select name="department" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none">
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Department Rank</label>
              <input name="rank" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" placeholder="e.g. Officer I" />
            </div>
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Community Rank</label>
              <select name="communityRank" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" defaultValue={allowedCommunityRanks[allowedCommunityRanks.length - 1]}>
                {allowedCommunityRanks.map((r) => (
                  <option key={r} value={r}>
                    {settings.communityRankMeta[r]?.label ?? r}
                  </option>
                ))}
              </select>
              {effectivePermissionGroup !== "HeadAdministration" && (
                <div className="text-[10px] text-slate-600 mt-1">Limited to your rank and below</div>
              )}
            </div>
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Initial Status</label>
              <select name="status" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none">
                {statusNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Subdivisions</label>
              <input name="subdivisions" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Traffic, Training…" />
            </div>

            <div className="col-span-2 border-t border-slate-800 pt-4 mt-2">
              <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Lock className="w-3 h-3" /> Sensitive Information (Staff-In-Training+)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Discord ID</label>
                  <input name="discordId" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none" placeholder="123456789…" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">TeamSpeak UID</label>
                  <input name="teamspeakUid" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none" placeholder="ABCDE…" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Website Link</label>
                  <input name="websiteLink" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none" placeholder="https://…" />
                </div>
              </div>
            </div>

            <div className="col-span-2 mt-4">
              <button type="submit" className="w-full text-white font-bold py-2.5 rounded-lg transition-all shadow-lg" style={{ backgroundColor: settings.customPrimaryColor }}>
                Finalize Recruitment
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Edit Member Modal */}
      {editingMember && isAuthedAdmin && userPerms.canEditMembers && (
        <ModalShell title={`Edit Personnel: ${editingMember.name}`} icon={<Settings className="w-4 h-4" style={{ color: settings.customPrimaryColor }} />} onClose={() => setEditingMember(null)}>
          <form onSubmit={handleEditMember} className="p-4 overflow-y-auto grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Full Name</label>
              <input required name="name" defaultValue={editingMember.name} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Community ID (Locked)</label>
              <div className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 text-sm text-amber-500 font-mono font-bold">{editingMember.communityId}</div>
            </div>
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Unit Number</label>
              <input name="unitNumber" defaultValue={editingMember.unitNumber} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Department</label>
              <select name="department" defaultValue={editingMember.department} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none">
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Department Rank</label>
              <input name="rank" defaultValue={editingMember.rank} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Community Rank</label>
              <select name="communityRank" defaultValue={editingMember.communityRank} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none">
                {(effectivePermissionGroup === "HeadAdministration" ? COMMUNITY_RANKS : allowedCommunityRanks).map((r) => (
                  <option key={r} value={r}>
                    {settings.communityRankMeta[r]?.label ?? r}
                  </option>
                ))}
              </select>
              {effectivePermissionGroup !== "HeadAdministration" && (
                <div className="text-[10px] text-slate-600 mt-1">Limited to your rank and below</div>
              )}
            </div>
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Status</label>
              <select name="status" defaultValue={editingMember.status} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none">
                {statusNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Subdivisions</label>
              <input name="subdivisions" defaultValue={editingMember.subdivisions} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>

            <div className="col-span-2 border-t border-slate-800 pt-4 mt-2">
              <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Lock className="w-3 h-3" /> Sensitive Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Discord ID</label>
                  <input name="discordId" defaultValue={editingMember.discordId} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">TeamSpeak UID</label>
                  <input name="teamspeakUid" defaultValue={editingMember.teamspeakUid} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Website Link</label>
                  <input name="websiteLink" defaultValue={editingMember.websiteLink} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none" />
                </div>
              </div>
            </div>

            <div className="col-span-2 mt-4">
              <button type="submit" className="w-full text-white font-bold py-2.5 rounded-lg transition-all shadow-lg" style={{ backgroundColor: settings.customPrimaryColor }}>
                Save Changes
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Transfer Modal */}
      {transferringMember && isAuthedAdmin && userPerms.canTransferDepts && (
        <ModalShell title="Personnel Transfer Workflow" icon={<ArrowRightLeft className="w-4 h-4 text-emerald-500" />} onClose={() => setTransferringMember(null)}>
          <form onSubmit={processTransfer} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Subject</p>
              <p className="text-sm font-bold text-white">
                {transferringMember.name} <span className="text-amber-500 font-mono">#{transferringMember.communityNumber}</span>
              </p>
              <p className="text-[10px] text-slate-400">Current: {transferringMember.department} — {transferringMember.rank}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">To Department</label>
                <select name="toDept" defaultValue={transferringMember.department} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500">
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">New Unit Number</label>
                <input name="unitNumber" defaultValue={transferringMember.unitNumber} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">New Department Rank</label>
              <input name="rank" defaultValue={transferringMember.rank} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Community Rank (if changed)</label>
              <select name="communityRank" defaultValue={transferringMember.communityRank} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none">
                {(effectivePermissionGroup === "HeadAdministration" ? COMMUNITY_RANKS : allowedCommunityRanks).map((r) => (
                  <option key={r} value={r}>
                    {settings.communityRankMeta[r]?.label ?? r}
                  </option>
                ))}
              </select>
              {effectivePermissionGroup !== "HeadAdministration" && (
                <div className="text-[10px] text-slate-600 mt-1">Limited to your rank and below</div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Subdivisions (if changed)</label>
              <input name="subdivisions" defaultValue={transferringMember.subdivisions} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Status (if changed)</label>
              <select name="status" defaultValue={transferringMember.status} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none">
                {statusNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Reason Category</label>
              <select name="reason" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="Career Progression">Career Progression</option>
                <option value="Department Needs">Department Needs</option>
                <option value="Performance Review">Performance Review</option>
                <option value="Disciplinary">Disciplinary Transfer</option>
                <option value="Personal">Personal Preference</option>
                <option value="Other">Other (See Details)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Transfer Details</label>
              <textarea name="detail" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none h-20" placeholder="Provide context for this move…"></textarea>
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-emerald-900/20 uppercase text-xs tracking-widest">
              Authorize Transfer
            </button>
          </form>
        </ModalShell>
      )}

      {/* Removal Modal */}
      {removingMember && isAuthedAdmin && userPerms.canRemoveMembers && (
        <ModalShell title="Discharging Personnel" icon={<Trash2 className="w-4 h-4 text-red-500" />} onClose={() => setRemovingMember(null)}>
          <form onSubmit={processRemoval} className="p-4 space-y-4">
            <p className="text-xs text-slate-400">
              Removing <span className="text-white font-bold">{removingMember.name}</span> from the active roster. This will archive their record for future recovery.
            </p>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Discharge Type</label>
              <select name="reason" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="Discipline">Discipline / Termination</option>
                <option value="Proper Resignation">Proper Resignation</option>
                <option value="Improper Resignation">Improper Resignation</option>
                <option value="Retirement">Retirement</option>
                <option value="Inactive Removal">Inactive Removal</option>
                <option value="Other">Other (Special Circumstance)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Final Remarks</label>
              <textarea required name="detail" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none h-24" placeholder="Enter reason and discharge details…"></textarea>
            </div>
            <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-lg transition-all">
              Confirm Discharge
            </button>
          </form>
        </ModalShell>
      )}

      {/* Archive Modal */}
      {showArchive && isAuthedAdmin && userPerms.canAccessArchive && (
        <ModalShell title="Discharged Personnel Archive" icon={<Users className="w-4 h-4 text-emerald-500" />} onClose={() => setShowArchive(false)} maxWidthClass="max-w-4xl" tall>
          <div className="flex-1 overflow-auto p-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-800">
                  <th className="px-3 py-2">CID</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Last Dept</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {archivedMembers.map((am) => (
                  <tr key={am.id} className="hover:bg-white/5">
                    <td className="px-3 py-3 font-mono text-amber-500">{am.communityNumber}</td>
                    <td className="px-3 py-3 font-bold">{am.name}</td>
                    <td className="px-3 py-3 text-slate-400">{am.department}</td>
                    <td className="px-3 py-3"><span className="text-red-400 font-bold">{am.dischargeReason}</span></td>
                    <td className="px-3 py-3 text-slate-500">{am.dischargeDate}</td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => restoreFromArchive(am)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] transition-colors">RESTORE</button>
                    </td>
                  </tr>
                ))}
                {archivedMembers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-500 font-bold italic uppercase tracking-widest">
                      No archived personnel records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ModalShell>
      )}

      {/* Settings Modal */}
      {showSettings && isAuthedAdmin && (userPerms.canManageSettings || userPerms.canManagePermissions || userPerms.canManageUsers) && (
        <ModalShell title="Community Configuration" icon={<Settings className="w-4 h-4" style={{ color: settings.customPrimaryColor }} />} onClose={() => setShowSettings(false)} maxWidthClass="max-w-6xl" tall>
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* LEFT: Auth/Permissions + Accounts */}
            <section className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="w-4 h-4 text-amber-500" />
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300">Auth & Permissions</h4>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={settings.auth.requireLoginForAdmin}
                        disabled={!userPerms.canManageSettings}
                        onChange={(e) => setSettings({ ...settings, auth: { ...settings.auth, requireLoginForAdmin: e.target.checked } })}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900"
                      />
                      Require login to access Admin view
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={settings.auth.disableAccountOnDischarge}
                        disabled={!userPerms.canManageSettings}
                        onChange={(e) => setSettings({ ...settings, auth: { ...settings.auth, disableAccountOnDischarge: e.target.checked } })}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900"
                      />
                      Auto-disable linked account on discharge
                    </label>
                  </div>

                  <div className="border-t border-slate-800 pt-4">
                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Community Rank → Auth Group Mapping</div>
                    <div className="space-y-2">
                      {COMMUNITY_RANKS.map((r) => (
                        <div key={r} className="grid grid-cols-[1fr_170px] gap-3 items-center">
                          <div className="text-xs text-slate-300 font-bold">{settings.communityRankMeta[r]?.label ?? r}</div>
                          <select
                            value={settings.auth.communityRankToGroup[r]}
                            disabled={!userPerms.canManageSettings}
                            onChange={(e) => {
                              setSettings({
                                ...settings,
                                auth: {
                                  ...settings.auth,
                                  communityRankToGroup: { ...settings.auth.communityRankToGroup, [r]: e.target.value as PermissionGroup },
                                },
                              });
                            }}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs outline-none"
                          >
                            {PERMISSION_GROUPS.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                      {!userPerms.canManageSettings && <div className="text-[10px] text-slate-600">Head Administration required</div>}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 mt-3">
                  Permission changes are controlled by <span className="text-amber-400 font-bold">Head Administration</span> by default.
                </p>

                <div className="space-y-4 mt-4">
                  {(Object.keys(settings.permissions) as PermissionGroup[]).map((group) => {
                    const isHeadAdminGroup = group === "HeadAdministration";
                    const isAdminGroup = group === "Administration";
                    const canEditThisGroup = effectivePermissionGroup === "HeadAdministration" && userPerms.canManagePermissions;

                    return (
                      <div key={group} className={`p-3 bg-slate-950 rounded-lg border ${isHeadAdminGroup ? "border-amber-500/30" : "border-slate-800"}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-xs font-bold ${isHeadAdminGroup ? "text-amber-400" : isAdminGroup ? "text-purple-300" : "text-white"}`}>{group}</span>
                          {!canEditThisGroup && <span className="text-[10px] text-slate-600 italic">Locked</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                          {Object.entries(settings.permissions[group]).map(([key, val]) => (
                            <label key={key} className={`flex items-center gap-2 ${canEditThisGroup ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                              <input
                                type="checkbox"
                                checked={Boolean(val)}
                                disabled={!canEditThisGroup}
                                onChange={(e) => {
                                  const newPerms = { ...settings.permissions };
                                  newPerms[group] = { ...newPerms[group], [key]: e.target.checked } as PermissionConfig;
                                  setSettings({ ...settings, permissions: newPerms });
                                }}
                                className="w-3 h-3 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                              />
                              <span className="text-[10px] text-slate-400 capitalize">{key.replace("can", "").replace(/([A-Z])/g, " $1")}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Accounts Management */}
              {userPerms.canManageUsers && (
                <AccountManager
                  primaryColor={settings.customPrimaryColor}
                  accounts={accounts}
                  setAccounts={setAccounts}
                  members={members}
                  archivedMembers={archivedMembers}
                  auth={settings.auth}
                />
              )}
            </section>

            {/* RIGHT: Visual Controls + Patrol Requirements + Logs */}
            <section className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="w-4 h-4" style={{ color: settings.customPrimaryColor }} />
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300">Visual Controls</h4>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {["dark", "midnight", "blue", "crimson", "emerald", "sunset", "ocean"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setSettings({ ...settings, theme: t as RosterSettings["theme"] })}
                      className={`px-2 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all ${
                        settings.theme === t
                          ? "text-white shadow-lg"
                          : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600"
                      }`}
                      style={settings.theme === t ? { backgroundColor: settings.customPrimaryColor, borderColor: toHexAlpha(settings.customPrimaryColor, 0.35) } : undefined}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Primary Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settings.customPrimaryColor}
                        onChange={(e) => setSettings({ ...settings, customPrimaryColor: e.target.value })}
                        disabled={!userPerms.canManageSettings}
                        className="h-10 w-14 bg-transparent border border-slate-800 rounded"
                        title="Primary color"
                      />
                      <input
                        value={settings.customPrimaryColor}
                        onChange={(e) => setSettings({ ...settings, customPrimaryColor: e.target.value })}
                        disabled={!userPerms.canManageSettings}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono outline-none"
                      />
                    </div>
                    {!userPerms.canManageSettings && <div className="text-[10px] text-slate-600 mt-1">Head Administration required</div>}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Statuses</label>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-2">
                      {settings.statusCatalog.map((s, idx) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <input
                            type="color"
                            value={s.color}
                            disabled={!userPerms.canManageSettings}
                            onChange={(e) => {
                              const next = [...settings.statusCatalog];
                              next[idx] = { ...next[idx], color: e.target.value };
                              setSettings({ ...settings, statusCatalog: next });
                            }}
                            className="h-8 w-10 bg-transparent border border-slate-800 rounded"
                          />
                          <input
                            value={s.name}
                            disabled={!userPerms.canManageSettings}
                            onChange={(e) => {
                              const next = [...settings.statusCatalog];
                              next[idx] = { ...next[idx], name: e.target.value };
                              setSettings({ ...settings, statusCatalog: next });
                            }}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs outline-none"
                          />
                        </div>
                      ))}
                      {userPerms.canManageSettings && (
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, statusCatalog: [...settings.statusCatalog, { id: cryptoId(), name: "New Status", color: "#94a3b8" }] })}
                          className="w-full mt-2 px-2 py-2 rounded-lg border border-slate-800 bg-slate-900 text-[11px] font-bold text-slate-300 hover:text-white"
                        >
                          + Add Status
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Patrol Log Form URL</label>
                  <input
                    value={settings.patrolFormUrl || ""}
                    onChange={(e) => setSettings({ ...settings, patrolFormUrl: e.target.value })}
                    disabled={!userPerms.canManageSettings}
                    placeholder="https://docs.google.com/forms/..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none font-mono text-blue-400"
                  />
                </div>

                <div className="mt-6">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Monthly Hour Requirements</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-slate-950 border border-slate-800 rounded-xl p-3">
                    {DEPARTMENTS.map((d) => (
                      <div key={d} className="flex justify-between items-center p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400">{d}</span>
                        <input
                          type="number"
                          value={settings.departmentRequirements?.[d] ?? 4}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setSettings({ ...settings, departmentRequirements: { ...settings.departmentRequirements, [d]: val } });
                          }}
                          disabled={!userPerms.canManageSettings}
                          className="w-12 bg-slate-950 text-right px-1 py-0.5 text-xs font-mono rounded outline-none border border-slate-700 focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-6">
                <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Rank Visual Controls</h5>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Community Ranks</div>
                  <div className="space-y-2">
                    {COMMUNITY_RANKS.map((r) => {
                      const meta = settings.communityRankMeta[r];
                      return (
                        <div key={r} className="grid grid-cols-[100px_1fr_110px] gap-2 items-center">
                          <div className="text-[11px] text-slate-400 font-bold truncate" title={r}>{r}</div>
                          <input
                            value={meta.label}
                            disabled={!userPerms.canManageSettings}
                            onChange={(e) => setSettings({ ...settings, communityRankMeta: { ...settings.communityRankMeta, [r]: { ...meta, label: e.target.value } } })}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs outline-none"
                            placeholder="Display name"
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <input
                              type="color"
                              value={meta.color}
                              disabled={!userPerms.canManageSettings}
                              onChange={(e) => setSettings({ ...settings, communityRankMeta: { ...settings.communityRankMeta, [r]: { ...meta, color: e.target.value } } })}
                              className="h-8 w-12 bg-transparent border border-slate-800 rounded"
                            />
                            <div className="text-[10px] font-mono text-slate-500">{meta.color}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mt-4">
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Department Ranks (Catalog)</div>
                  <p className="text-[11px] text-slate-600 mb-3">Add ranks here to colorize the <span className="text-slate-300 font-bold">Rank</span> column when a member’s Department Rank matches.</p>

                  <DeptRankEditor
                    departments={DEPARTMENTS}
                    catalog={settings.departmentRankCatalog}
                    onChange={(next) => setSettings({ ...settings, departmentRankCatalog: next })}
                    editable={userPerms.canManageSettings}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300">System Logs & DB</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      setShowArchive(true);
                    }}
                    className="text-left px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-colors flex justify-between items-center"
                  >
                    <span>Archive Records</span>
                    <span className="bg-emerald-500/20 text-emerald-400 px-1.5 rounded-md text-[10px]">{archivedMembers.length}</span>
                  </button>
                  <div className="text-left px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-slate-400 flex justify-between items-center">
                    <span>Transfer Logs</span>
                    <span className="bg-blue-500/20 text-blue-400 px-1.5 rounded-md text-[10px]">{transferLogs.length}</span>
                  </div>
                  <div className="text-left px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-slate-400 flex justify-between items-center">
                    <span>Removal Logs</span>
                    <span className="bg-red-500/20 text-red-400 px-1.5 rounded-md text-[10px]">{removalLogs.length}</span>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-slate-600">This build stores data locally (localStorage). Replace with a real backend later for true security.</div>
              </div>
            </section>
          </div>

          <div className="p-4 border-t border-slate-800 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
            Configuration changes apply immediately
          </div>
        </ModalShell>
      )}

      {/* Patrol Manager Modal */}
      {showPatrolMgr && isAuthedAdmin && userPerms.canEditMembers && (
        <ModalShell title="Patrol & Activity Management" icon={<ArrowRightLeft className="w-4 h-4 rotate-45" style={{ color: settings.customPrimaryColor }} />} onClose={() => setShowPatrolMgr(false)} maxWidthClass="max-w-4xl" tall>
          <PatrolManager members={members} setMembers={setMembers} departments={DEPARTMENTS} requirements={settings.departmentRequirements} />
        </ModalShell>
      )}
    </div>
  );
}

// --- Subcomponents ---
function TabButton({ children, active, onClick, color = "blue" }: { children: React.ReactNode; active: boolean; onClick: () => void; color?: string }) {
  const activeStyles: Record<string, string> = {
    blue: "bg-blue-600/10 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]",
    purple: "bg-purple-600/10 border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)]",
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-tight transition-all flex items-center gap-1.5 ${
        active ? activeStyles[color] || activeStyles.blue : "bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function FilterField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs outline-none" />
    </div>
  );
}

function SortableTh({ label, active, onClick, className }: { label: string; active: boolean; onClick: () => void; className?: string }) {
  return (
    <th className={`px-4 py-3 ${className || ""}`}>
      <button onClick={onClick} className={`flex items-center gap-2 hover:text-slate-300 transition-colors ${active ? "text-slate-300" : "text-slate-500"}`}>
        <span>{label}</span>
        <ArrowUpDown className={`w-3.5 h-3.5 ${active ? "text-slate-300" : "text-slate-700"}`} />
      </button>
    </th>
  );
}

function ModalShell({
  title,
  icon,
  onClose,
  children,
  maxWidthClass = "max-w-2xl",
  tall,
}: {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
  tall?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-slate-900 border border-slate-800 rounded-xl w-full ${maxWidthClass} shadow-2xl overflow-hidden ${tall ? "h-[80vh] flex flex-col" : "max-h-[90vh] flex flex-col"}`}>
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/40">
          <h3 className="font-bold text-white flex items-center gap-2">{icon}{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DeptRankEditor({
  departments,
  catalog,
  onChange,
  editable,
}: {
  departments: Department[];
  catalog: Record<Department, DeptRankDef[]>;
  onChange: (next: Record<Department, DeptRankDef[]>) => void;
  editable: boolean;
}) {
  const [dept, setDept] = useState<Department>(departments[0]);
  const list = catalog[dept] ?? [];

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-bold">Department:</span>
          <select className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs outline-none" value={dept} onChange={(e) => setDept(e.target.value as Department)}>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {editable && (
          <button
            type="button"
            className="px-2 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-[11px] font-bold text-slate-300 hover:text-white"
            onClick={() => {
              const next = { ...catalog };
              next[dept] = [...list, { id: cryptoId(), name: "New Rank", color: "#94a3b8" }];
              onChange(next);
            }}
          >
            + Add Rank
          </button>
        )}
      </div>

      <div className="space-y-2">
        {list.map((r, idx) => (
          <div key={r.id} className="grid grid-cols-[40px_1fr_110px_90px] gap-2 items-center">
            <input
              type="color"
              value={r.color}
              disabled={!editable}
              onChange={(e) => {
                const next = { ...catalog };
                const copy = [...list];
                copy[idx] = { ...copy[idx], color: e.target.value };
                next[dept] = copy;
                onChange(next);
              }}
              className="h-9 w-10 bg-transparent border border-slate-800 rounded"
            />
            <input
              value={r.name}
              disabled={!editable}
              onChange={(e) => {
                const next = { ...catalog };
                const copy = [...list];
                copy[idx] = { ...copy[idx], name: e.target.value };
                next[dept] = copy;
                onChange(next);
              }}
              className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs outline-none"
            />
            <div className="text-[10px] font-mono text-slate-600 justify-self-end">{r.color}</div>
            {editable ? (
              <button
                type="button"
                onClick={() => {
                  const next = { ...catalog };
                  next[dept] = list.filter((x) => x.id !== r.id);
                  onChange(next);
                }}
                className="justify-self-end px-2 py-1 rounded-md border border-slate-800 bg-slate-900 text-[10px] font-bold text-red-300 hover:text-red-200"
              >
                Remove
              </button>
            ) : (
              <div />
            )}
          </div>
        ))}

        {list.length === 0 && <div className="text-[11px] text-slate-600 italic">No ranks defined for this department yet.</div>}
      </div>
    </div>
  );
}

function getDeptStyle(dept: Department) {
  const map: Record<Department, string> = {
    LSPD: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    SAHP: "bg-slate-500/10 border-slate-500/30 text-slate-300",
    BCSO: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    CIV: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    "Fire Rescue": "bg-red-500/10 border-red-500/30 text-red-400",
    Communications: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400",
    "Internal Affairs": "bg-purple-500/10 border-purple-500/30 text-purple-400",
    "Media Division": "bg-pink-500/10 border-pink-500/30 text-pink-400",
    Development: "bg-orange-500/10 border-orange-500/30 text-orange-400",
  };
  return map[dept] || "bg-slate-500/10 border-slate-500/30 text-slate-400";
}

function PatrolManager({
  members,
  setMembers,
  departments,
  requirements,
}: {
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  departments: Department[];
  requirements: Record<Department, number>;
}) {
  const [activeDept, setActiveDept] = useState<Department | "All">("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingChanges, setPendingChanges] = useState<Record<string, number>>({});

  const filtered = members.filter((m) => {
    const matchesDept = activeDept === "All" || m.department === activeDept;
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.communityNumber.includes(searchTerm) ||
      m.unitNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const handleHourChange = (id: string, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    setPendingChanges((prev) => ({ ...prev, [id]: num }));
  };

  const saveChanges = () => {
    setMembers((prev) =>
      prev.map((m) => {
        if (pendingChanges[m.id] !== undefined) {
          return { ...m, currentMonthHours: pendingChanges[m.id] };
        }
        return m;
      })
    );
    setPendingChanges({});
  };

  const runActivityCheck = () => {
    if (!confirm("This will update member statuses based on hours requirements. LOA/Reserve/Suspended/Training will be skipped. Continue?")) return;

    setMembers((prev) =>
      prev.map((m) => {
        if (["LOA", "Reserve", "Suspended", "Training"].includes(m.status)) return m;

        const req = requirements[m.department] ?? 0;
        const hours = pendingChanges[m.id] ?? m.currentMonthHours;

        if (hours >= req) {
          return { ...m, status: "Active" };
        }
        return { ...m, status: "Inactive" };
      })
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900">
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <button
            onClick={() => setActiveDept("All")}
            className={`px-3 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap ${activeDept === "All" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}
          >
            All
          </button>
          {departments.map((d) => (
            <button
              key={d}
              onClick={() => setActiveDept(d)}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap ${activeDept === d ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900 z-10">
            <tr className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-800">
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Dept</th>
              <th className="px-3 py-2 text-center">Req.</th>
              <th className="px-3 py-2 text-center">Current Hrs</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filtered.map((m) => {
              const req = requirements[m.department] ?? 0;
              const currentVal = pendingChanges[m.id] ?? m.currentMonthHours;
              const isLow = currentVal < req;

              return (
                <tr key={m.id} className="hover:bg-white/5">
                  <td className="px-3 py-2">
                    <div className="font-bold text-white">{m.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{m.unitNumber}</div>
                  </td>
                  <td className="px-3 py-2 text-[10px] font-bold text-slate-400">{m.department}</td>
                  <td className="px-3 py-2 text-center text-slate-500 font-mono">{req}</td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      step="0.5"
                      value={currentVal}
                      onChange={(e) => handleHourChange(m.id, e.target.value)}
                      className={`w-16 bg-slate-950 border rounded px-1 py-1 text-center font-mono text-xs outline-none focus:border-blue-500 ${isLow ? "border-red-500/50 text-red-400" : "border-slate-700 text-emerald-400"}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${m.status === "Active" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}
                    >
                      {m.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
        <div className="text-[10px] text-slate-500">
          <span className="text-amber-400 font-bold">{Object.keys(pendingChanges).length}</span> pending edits
        </div>
        <div className="flex gap-3">
          <button onClick={runActivityCheck} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors">
            Run Activity Check
          </button>
          <button
            onClick={saveChanges}
            disabled={Object.keys(pendingChanges).length === 0}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${Object.keys(pendingChanges).length > 0 ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20" : "bg-slate-800 text-slate-500 cursor-not-allowed"}`}
          >
            Save Hours
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthGate({
  primaryColor,
  accounts,
  setAccounts,
  setSession,
  settings,
  members,
  onClose,
}: {
  primaryColor: string;
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
  settings: RosterSettings;
  members: Member[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doLogin = async () => {
    setError(null);
    setBusy(true);
    try {
      const acct = accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
      if (!acct) throw new Error("Account not found.");
      if (!acct.enabled) throw new Error("Account is disabled.");

      const pwdHash = await hashPassword(password);
      if (pwdHash !== acct.passwordHash) throw new Error("Incorrect password.");

      setAccounts((prev) => prev.map((a) => (a.id === acct.id ? { ...a, lastLoginAt: new Date().toISOString() } : a)));
      setSession({ accountId: acct.id, createdAt: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  const doSignup = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!settings.auth.allowInviteSignup) throw new Error("Sign-up is disabled. Contact Admin/Head Admin.");
      if (settings.auth.inviteCode && inviteCode.trim() !== settings.auth.inviteCode.trim()) {
        throw new Error("Invalid invite code.");
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail.includes("@")) throw new Error("Enter a valid email.");
      if (accounts.some((a) => a.email.toLowerCase() === normalizedEmail)) throw new Error("Email already registered.");
      if (password.length < 8) throw new Error("Password must be at least 8 characters.");

      // Signup creates a MEMBER-level account by default (must be promoted/linked by staff)
      const pwdHash = await hashPassword(password);
      const acct: Account = {
        id: cryptoId(),
        email: normalizedEmail,
        displayName: displayName.trim() || normalizedEmail,
        passwordHash: pwdHash,
        enabled: true,
        createdAt: new Date().toISOString(),
      };
      setAccounts((prev) => [...prev, acct]);
      setSession({ accountId: acct.id, createdAt: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-up failed.");
    } finally {
      setBusy(false);
    }
  };

  const directorExists = accounts.some((a) => a.email.toLowerCase() === "director@scenicrp.local");
  const directorLinked = directorExists && members.some((m) => m.communityNumber === "4521");

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5" style={{ color: primaryColor }} />
            <div>
              <div className="text-white font-extrabold tracking-tight">Admin Access</div>
              <div className="text-[11px] text-slate-500 font-bold uppercase">Secure login required</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setMode("login")}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${mode === "login" ? "text-white" : "text-slate-400"}`}
              style={mode === "login" ? { backgroundColor: toHexAlpha(primaryColor, 0.18), borderColor: toHexAlpha(primaryColor, 0.35) } : { borderColor: "#1f2937" }}
            >
              Login
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${mode === "signup" ? "text-white" : "text-slate-400"}`}
              style={mode === "signup" ? { backgroundColor: toHexAlpha(primaryColor, 0.18), borderColor: toHexAlpha(primaryColor, 0.35) } : { borderColor: "#1f2937" }}
            >
              Sign up
            </button>
          </div>

          {error && <div className="mb-4 text-xs font-bold text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>}

          {mode === "signup" && !settings.auth.allowInviteSignup && (
            <div className="mb-4 text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              Sign-up is currently disabled. An Admin/Head Admin must create and link accounts in System Settings.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mode === "signup" && (
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Display Name</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" placeholder="e.g. Director" />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" placeholder="name@scenicrp…" />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" placeholder="••••••••" />
            </div>

            {mode === "signup" && settings.auth.allowInviteSignup && (
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Invite Code</label>
                <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Provided by staff" />
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            {mode === "login" ? (
              <button
                disabled={busy}
                onClick={doLogin}
                className={`flex-1 py-2.5 rounded-lg text-white font-extrabold transition-colors ${busy ? "bg-slate-700" : "bg-blue-600 hover:bg-blue-500"}`}
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            ) : (
              <button
                disabled={busy || !settings.auth.allowInviteSignup}
                onClick={doSignup}
                className={`flex-1 py-2.5 rounded-lg text-white font-extrabold transition-colors ${
                  busy ? "bg-slate-700" : settings.auth.allowInviteSignup ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-700"
                }`}
              >
                {busy ? "Creating…" : "Create account"}
              </button>
            )}

            <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 font-bold">
              Back to Public
            </button>
          </div>

          <div className="mt-4 text-[11px] text-slate-600">
            <div className="font-bold uppercase text-[10px] text-slate-500 mb-1">Setup note</div>
            <div>
              This build uses <span className="text-slate-300 font-bold">localStorage</span> for demo accounts. For real security, connect this roster to a server-side auth provider.
            </div>
            <div className="mt-2">
              Bootstrap account (first run): <span className="font-mono text-slate-300">director@scenicrp.local</span> / <span className="font-mono text-slate-300">scenicrp</span>
              {!directorExists && <span className="text-amber-400 font-bold"> (seeding…)</span>}
              {directorExists && !directorLinked && <span className="text-amber-400 font-bold"> (CID 4521 missing)</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountManager({
  primaryColor,
  accounts,
  setAccounts,
  members,
  archivedMembers,
  auth,
}: {
  primaryColor: string;
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  members: Member[];
  archivedMembers: ArchivedMember[];
  auth: AuthSettings;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newLink, setNewLink] = useState<string>("");
  const [newOverride, setNewOverride] = useState<"" | PermissionGroup>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allPeople = useMemo(() => {
    const active = members.map((m) => ({
      communityNumber: m.communityNumber,
      name: `${m.name} (Active)`
    }));
    const archived = archivedMembers.map((m) => ({
      communityNumber: m.communityNumber,
      name: `${m.name} (Archived)`
    }));
    const merged = [...active, ...archived];
    merged.sort((a, b) => compareString(a.name, b.name));
    return merged;
  }, [archivedMembers, members]);

  const createAccount = async () => {
    setError(null);
    setBusy(true);
    try {
      const normalizedEmail = newEmail.trim().toLowerCase();
      if (!normalizedEmail.includes("@")) throw new Error("Enter a valid email.");
      if (accounts.some((a) => a.email.toLowerCase() === normalizedEmail)) throw new Error("Email already exists.");
      if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.");

      const pwdHash = await hashPassword(newPassword);
      const acct: Account = {
        id: cryptoId(),
        email: normalizedEmail,
        displayName: newName.trim() || normalizedEmail,
        passwordHash: pwdHash,
        enabled: true,
        linkedCommunityNumber: newLink || undefined,
        roleOverride: newOverride || undefined,
        createdAt: new Date().toISOString(),
      };
      setAccounts((prev) => [...prev, acct]);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewLink("");
      setNewOverride("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create account.");
    } finally {
      setBusy(false);
    }
  };

  const setAccountPassword = async (accountId: string, password: string) => {
    const pwd = password.trim();
    if (pwd.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }
    const pwdHash = await hashPassword(pwd);
    setAccounts((prev) => prev.map((a) => (a.id === accountId ? { ...a, passwordHash: pwdHash } : a)));
    alert("Password updated.");
  };

  const effectiveGroupFor = (acct: Account): PermissionGroup => {
    if (!acct.enabled) return "Member";
    if (acct.roleOverride) return acct.roleOverride;
    if (acct.linkedCommunityNumber) {
      const m = members.find((x) => x.communityNumber === acct.linkedCommunityNumber);
      if (m) return auth.communityRankToGroup[m.communityRank];
    }
    return "Member";
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4" style={{ color: primaryColor }} />
        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300">Accounts & Access</h4>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
        <div className="text-[11px] text-slate-500 mb-3">
          Create accounts for Staff+ and link them to a member (Community ID). Their effective access updates automatically when the member is promoted/demoted.
        </div>

        {error && <div className="mb-3 text-xs font-bold text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Email</label>
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none" placeholder="name@scenicrp…" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Display Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none" placeholder="e.g. Director" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Initial Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none" placeholder="Minimum 8 characters" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Link to Member (optional)</label>
            <select value={newLink} onChange={(e) => setNewLink(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none">
              <option value="">Unlinked</option>
              {allPeople.map((p) => (
                <option key={p.communityNumber} value={p.communityNumber}>
                  #{p.communityNumber} — {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Role Override (optional)</label>
            <select value={newOverride} onChange={(e) => setNewOverride(e.target.value as any)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none">
              <option value="">Auto (from linked member)</option>
              <option value="Member">Member</option>
              <option value="StaffInTraining">Staff In Training</option>
              <option value="Staff">Staff</option>
              <option value="Administration">Administration</option>
              <option value="HeadAdministration">Head Administration</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              disabled={busy}
              onClick={createAccount}
              className={`w-full py-2.5 rounded-lg text-white font-extrabold transition-colors ${busy ? "bg-slate-700" : "bg-emerald-600 hover:bg-emerald-500"}`}
            >
              {busy ? "Creating…" : "Create Account"}
            </button>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-5 pt-4">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Existing Accounts</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-800">
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Linked CID</th>
                  <th className="px-2 py-2">Override</th>
                  <th className="px-2 py-2">Effective</th>
                  <th className="px-2 py-2 text-center">Enabled</th>
                  <th className="px-2 py-2">Password</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {accounts
                  .slice()
                  .sort((a, b) => compareString(a.email, b.email))
                  .map((a) => (
                    <AccountRow key={a.id} account={a} allPeople={allPeople} effectiveGroup={effectiveGroupFor(a)} setAccounts={setAccounts} setAccountPassword={setAccountPassword} />
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-5 pt-4">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Invite Sign-up (Optional)</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={auth.allowInviteSignup}
                onChange={(e) => {
                  // No direct settings mutation here; this is a pure manager. The parent settings panel controls this.
                  alert("Invite sign-up is controlled in code via System Settings 'Auth & Permissions' section. (Demo limitation)" );
                  void e;
                }}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900"
                disabled
              />
              Enable invite-only signup (disabled by default)
            </label>
            <div>
              <div className="text-xs text-slate-500">Invite Code is stored in Settings.auth.inviteCode (configure later with a backend).</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountRow({
  account,
  allPeople,
  effectiveGroup,
  setAccounts,
  setAccountPassword,
}: {
  account: Account;
  allPeople: { communityNumber: string; name: string }[];
  effectiveGroup: PermissionGroup;
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  setAccountPassword: (id: string, password: string) => Promise<void>;
}) {
  const [pwd, setPwd] = useState("");
  return (
    <tr className="hover:bg-white/5">
      <td className="px-2 py-2 font-mono text-slate-300">{account.email}</td>
      <td className="px-2 py-2">
        <select
          value={account.linkedCommunityNumber ?? ""}
          onChange={(e) => setAccounts((prev) => prev.map((x) => (x.id === account.id ? { ...x, linkedCommunityNumber: e.target.value || undefined } : x)))}
          className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] outline-none"
        >
          <option value="">Unlinked</option>
          {allPeople.map((p) => (
            <option key={p.communityNumber} value={p.communityNumber}>
              #{p.communityNumber} — {p.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          value={account.roleOverride ?? ""}
          onChange={(e) => setAccounts((prev) => prev.map((x) => (x.id === account.id ? { ...x, roleOverride: (e.target.value as PermissionGroup) || undefined } : x)))}
          className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] outline-none"
        >
          <option value="">Auto</option>
          <option value="Member">Member</option>
          <option value="StaffInTraining">StaffInTraining</option>
          <option value="Staff">Staff</option>
          <option value="Administration">Administration</option>
          <option value="HeadAdministration">HeadAdministration</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <span className="px-2 py-0.5 rounded border border-slate-800 bg-slate-950 text-[10px] font-bold text-emerald-400">{effectiveGroup}</span>
      </td>
      <td className="px-2 py-2 text-center">
        <input
          type="checkbox"
          checked={account.enabled}
          onChange={(e) => setAccounts((prev) => prev.map((x) => (x.id === account.id ? { ...x, enabled: e.target.checked } : x)))}
          className="w-4 h-4 rounded border-slate-700 bg-slate-900"
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] outline-none w-40"
            placeholder="New password"
          />
          <button
            onClick={() => setAccountPassword(account.id, pwd).then(() => setPwd(""))}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold"
          >
            Set
          </button>
        </div>
      </td>
      <td className="px-2 py-2 text-right">
        <button
          onClick={() => {
            if (!confirm(`Delete account ${account.email}?`)) return;
            setAccounts((prev) => prev.filter((x) => x.id !== account.id));
          }}
          className="px-2 py-1 rounded border border-slate-800 bg-slate-900 text-[10px] font-bold text-red-300 hover:text-red-200"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
