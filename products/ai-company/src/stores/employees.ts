import { create } from "zustand";
import type { Employee } from "@/types";
import * as api from "@/lib/api";

interface EmployeesStore {
  employees: Employee[];
  loading: boolean;
  fetch: () => Promise<void>;
  create: (data: Partial<Employee>) => Promise<void>;
  update: (id: string, data: Partial<Employee>) => Promise<void>;
}

export const useEmployeesStore = create<EmployeesStore>((set, get) => ({
  employees: [],
  loading: true,
  fetch: async () => {
    set({ loading: true });
    const employees = await api.getEmployees();
    set({ employees, loading: false });
  },
  create: async (data) => {
    const employee = await api.createEmployee(data);
    set({ employees: [...get().employees, employee] });
  },
  update: async (id, data) => {
    const updated = await api.updateEmployee(id, data);
    set({
      employees: get().employees.map((e) => (e.id === id ? updated : e)),
    });
  },
}));
