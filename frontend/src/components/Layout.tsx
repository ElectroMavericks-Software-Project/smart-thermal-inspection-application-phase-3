import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Zap, User as UserIcon, Mail, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

interface UserData {
  name: string;
  username: string;
  email: string;
}

const Layout = ({ children, title = "Transformers" }: LayoutProps) => {
  const [user, setUser] = useState<UserData | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      navigate("/login");
      return;
    }
    try {
      setUser(JSON.parse(raw));
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  const getInitials = (full: string) =>
    full
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handleLogout = () => {
    localStorage.removeItem("user");
    toast({ title: "Logged out", description: "You have been successfully logged out." });
    navigate("/login");
  };

  // simple loader while reading user
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Brand + Title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-primary p-2">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold">ThermoScanX</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>≡</span>
              <h1 className="text-lg font-medium text-foreground">{title}</h1>
            </div>
          </div>

          {/* Top-right user menu */}
          <div className="flex items-center gap-3">
            {/* <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
              <UserIcon className="h-5 w-5" />
            </Button> */}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-md px-2 py-1 hover:bg-muted">
                  <Avatar className="h-8 w-8">
                    {/* If you later store an avatar URL in user, put it here */}
                    <AvatarImage src="" alt={user.name} />
                    <AvatarFallback>{getInitials(user.name || "U")}</AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <div className="font-medium leading-4">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="font-semibold">{user.name}</span>
                  <span className="text-xs text-muted-foreground">@{user.username}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <Mail className="mr-2 h-4 w-4" />
                  <span>{user.email}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card p-4">
          <nav className="space-y-2">
            <Button
              variant="secondary"
              className="w-full justify-start gap-2"
              onClick={() => navigate("/")}
            >
              <Zap className="h-4 w-4" />
              Transformer
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => navigate("/settings")}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
