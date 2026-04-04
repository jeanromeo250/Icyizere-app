import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "manager" | "employee";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

interface EmployeePermissions {
  id: string;
  employee_user_id: string;
  manager_user_id: string;
  can_add_stock: boolean;
  can_remove_stock: boolean;
  can_view_stock: boolean;
  can_add_product: boolean;
  can_edit_product: boolean;
  can_delete_product: boolean;
  can_record_sales: boolean;
  can_view_sales: boolean;
  can_add_expenses: boolean;
  can_view_expenses: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  permissions: EmployeePermissions | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const mapEmployeePermissions = (row: any): EmployeePermissions => ({
  id: row.id,
  employee_user_id: row.employee_user_id,
  manager_user_id: row.manager_user_id,
  can_add_stock: row.can_add_stock,
  can_remove_stock: row.can_remove_stock,
  can_view_stock: row.can_view_stock,
  can_add_product: row.can_add_product,
  can_edit_product: row.can_edit_product,
  can_delete_product: row.can_delete_product,
  can_record_sales: row.can_record_sales,
  can_view_sales: row.can_view_sales,
  can_add_expenses: row.can_add_expenses,
  can_view_expenses: row.can_view_expenses,
  created_at: row.created_at,
  updated_at: row.updated_at,
});
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  permissions: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<EmployeePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      const [profileRes, permRes] = await Promise.all([
        supabase.from("profiles" as any).select("*").eq("user_id", userId).single(),
        supabase.from("employee_permissions" as any).select("*").eq("employee_user_id", userId).single(),
      ]);

      if (profileRes.error && profileRes.error.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileRes.error);
      }

      if (permRes.error && permRes.error.code !== 'PGRST116') {
        console.error('Permissions fetch error:', permRes.error);
      }

      if (profileRes.data) setProfile(profileRes.data as any);
      if (permRes.data) setPermissions(mapEmployeePermissions(permRes.data));

      const { data: roleData, error: roleError } = await (supabase
        .from("user_roles" as any)
        .select("role")
        .eq("user_id", userId)
        .single() as any);

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Role fetch error:', roleError);
      }

      if (roleData?.role) {
        setRole(roleData.role as AppRole);
      } else {
        // Fallback to user metadata
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('User fetch error:', userError);
        }
        const metaRole = user?.user_metadata?.role as string;
        setRole((metaRole === "manager" || metaRole === "employee") ? metaRole : "employee");
      }
    } catch (error) {
      console.error('fetchUserData error:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchUserData(user.id);
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        // First, try to get the current session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session error:', error);
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        console.log('Session retrieved:', session?.user?.id, session?.access_token ? 'has token' : 'no token');

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            console.log('Fetching user data for session user:', session.user.id);
            await fetchUserData(session.user.id);
          } else {
            console.log('No session user, clearing state');
            setProfile(null);
            setRole(null);
            setPermissions(null);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initialize auth state
    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id, session?.access_token ? 'has token' : 'no token');

        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Small delay to ensure session is fully established
          setTimeout(async () => {
            if (mounted) {
              console.log('Fetching user data for:', session.user.id);
              await fetchUserData(session.user.id);
            }
          }, 100);
        } else {
          console.log('Clearing auth state');
          setProfile(null);
          setRole(null);
          setPermissions(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setPermissions(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, permissions, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
