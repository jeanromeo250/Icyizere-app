import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, Eye, EyeOff, MapPin, Phone, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    const fullName = fd.get("fullName") as string;
    const businessName = fd.get("businessName") as string;
    const phone = fd.get("phone") as string;
    const location = fd.get("location") as string;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          business_name: businessName,
          phone,
          location,
          role: "manager",
        },
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Account created! You can now sign in.");
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-primary px-6">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full py-8">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-4">
            <Store className="h-8 w-8 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold text-primary-foreground">E-Shop</h1>
          <p className="text-primary-foreground/70 mt-1 text-sm">Smart Stock & Business Management</p>
        </div>

        {/* Registration Form */}
        <div className="bg-card rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-foreground mb-1">Create Manager Account</h2>
          <p className="text-sm text-muted-foreground mb-4">Set up your business to get started</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-foreground">Full Name</Label>
              <Input id="fullName" name="fullName" placeholder="John Doe" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="businessName" className="text-foreground">
                <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Business Name</span>
              </Label>
              <Input id="businessName" name="businessName" placeholder="My Business Ltd" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-foreground">
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Phone Number</span>
              </Label>
              <Input id="phone" name="phone" placeholder="+1 (555) 000-0000" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Location</span>
              </Label>
              <Input id="location" name="location" placeholder="City, Country" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full font-semibold" disabled={loading}>
              {loading ? "Creating Account..." : "Create Manager Account"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate("/login")}
              className="text-sm text-primary font-medium hover:underline"
            >
              Already have an account? Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
