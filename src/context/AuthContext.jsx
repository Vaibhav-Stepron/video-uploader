import { useState, useEffect } from "react";
import { initDB } from "@/lib/indexedDB";
import PasswordScreen from "@/components/PasswordScreen";
import LoadingScreen from "@/components/LoadingScreen";
import { AuthContext } from "./authContextInstance";

const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [passwordInput, setPasswordInput] = useState("");
    const [passwordError, setPasswordError] = useState("");

    // Check for existing authentication on mount
    useEffect(() => {
        const initialize = async () => {
            try {
                await initDB();
                const isAuth = localStorage.getItem("videoUploaderAuth") === "true";
                if (isAuth) {
                    setIsAuthenticated(true);
                }
                // Keep loading screen visible for minimum time
                await new Promise((resolve) => setTimeout(resolve, 1000));
                setIsLoading(false);
            } catch (error) {
                console.error("Failed to initialize:", error);
                setIsLoading(false);
            }
        };
        initialize();
    }, []);

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        setPasswordError("");

        const correctPassword = "Stepron@123";

        if (passwordInput === correctPassword) {
            localStorage.setItem("videoUploaderAuth", "true");
            setIsAuthenticated(true);
            setPasswordInput("");
        } else {
            setPasswordError("Incorrect password. Please try again.");
        }
    };

    const logout = () => {
        localStorage.removeItem("videoUploaderAuth");
        setIsAuthenticated(false);
    };

    if (isLoading) {
        return <LoadingScreen />;
    }

    if (!isAuthenticated) {
        return (
            <PasswordScreen
                passwordInput={passwordInput}
                setPasswordInput={setPasswordInput}
                handlePasswordSubmit={handlePasswordSubmit}
                passwordError={passwordError}
            />
        );
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;
