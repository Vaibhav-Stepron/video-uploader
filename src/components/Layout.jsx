import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Upload, Clock, Video, Menu, X, FolderUp, Settings, ChevronRight, Sun, Moon, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";

const Layout = () => {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { theme, toggleTheme } = useTheme();

    const navItems = [
        {
            path: "/",
            label: "Upload Video",
            icon: Upload,
            description: "Single video upload"
        },
        {
            path: "/upload-multiple",
            label: "Upload Multiple",
            icon: FolderUp,
            description: "Batch upload videos"
        },
        {
            path: "/history",
            label: "History",
            icon: Clock,
            description: "View upload history"
        },
        {
            path: "/changelog",
            label: "Changelog",
            icon: FileText,
            description: "View updates & changes"
        },
    ];

    const SidebarContent = ({ onItemClick }) => (
        <>
            {/* Logo Section */}
            <div className="p-5 border-b border-border/30">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20">
                        <Video className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-foreground">Video Uploader</h1>
                        <p className="text-xs text-muted-foreground">Manage your videos</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1">
                <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Menu
                </p>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={onItemClick}
                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${isActive
                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                }`}
                        >
                            <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${isActive ? "bg-white/20" : "bg-secondary group-hover:bg-primary/10"
                                }`}>
                                <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                                <span className="font-medium text-sm">{item.label}</span>
                            </div>
                            {isActive && <ChevronRight className="h-4 w-4 opacity-70" />}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border/30">
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                        <Settings className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Pro Version</p>
                        <p className="text-xs text-muted-foreground">Unlimited uploads</p>
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar for desktop */}
            <aside className="hidden md:flex md:flex-col md:w-72 bg-sidebar border-r border-border/30">
                <SidebarContent />
            </aside>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                >
                    <aside
                        className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-border/30 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute right-3 top-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full bg-secondary/50 hover:bg-secondary"
                                onClick={() => setSidebarOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <SidebarContent onItemClick={() => setSidebarOpen(false)} />
                    </aside>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top navbar */}
                <header className="h-16 border-b border-border/30 bg-card/50 backdrop-blur-md flex items-center justify-between px-4 md:px-6">
                    {/* Mobile menu button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden rounded-lg"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>

                    {/* Page title */}
                    <div className="flex-1 md:flex-none">
                        <h2 className="text-lg font-semibold text-foreground text-center md:text-left">
                            {navItems.find(item => item.path === location.pathname)?.label || "Dashboard"}
                        </h2>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-2">
                        {/* Theme toggle button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleTheme}
                            className="rounded-lg"
                            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        >
                            {theme === 'dark' ? (
                                <Sun className="h-5 w-5 text-yellow-500" />
                            ) : (
                                <Moon className="h-5 w-5 text-slate-700" />
                            )}
                        </Button>

                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-xs font-medium text-primary">Online</span>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto bg-background">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
