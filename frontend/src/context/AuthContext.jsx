import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = anon, obj = authed

  useEffect(() => {
    const token = localStorage.getItem("sf_token");
    if (!token) {
      setUser(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem("sf_token");
        setUser(false);
      });
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("sf_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password, name) => {
    const { data } = await api.post("/auth/register", { email, password, name });
    localStorage.setItem("sf_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("sf_token");
    setUser(false);
  };

  const refreshUser = async () => {
    const { data } = await api.get("/auth/me");
    setUser(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
