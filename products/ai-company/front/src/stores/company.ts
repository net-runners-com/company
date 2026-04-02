import { create } from "zustand";
import type { Company } from "@/types";
import * as api from "@/lib/api";

interface CompanyStore {
  company: Company | null;
  loading: boolean;
  fetch: () => Promise<void>;
  create: (
    data: Pick<Company, "name" | "industry" | "mission" | "goals">
  ) => Promise<void>;
}

export const useCompanyStore = create<CompanyStore>((set) => ({
  company: null,
  loading: true,
  fetch: async () => {
    set({ loading: true });
    const company = await api.getCompany();
    set({ company, loading: false });
  },
  create: async (data) => {
    const company = await api.createCompany(data);
    set({ company });
  },
}));
