import { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { activeMultiGradient } from "../styles/gradients";
import { Z_INDEX_MODAL_BACKDROP, Z_INDEX_MODAL_CONTENT } from "../constants/zIndex";

interface AdminLoginModalProps {
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<boolean>;
}

export function AdminLoginModal({ onClose, onLogin }: AdminLoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const success = await onLogin(email, password);

    if (!success) {
      setError("Invalid credentials. Please try again.");
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4" 
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: Z_INDEX_MODAL_BACKDROP,
      }}
      onClick={onClose}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full relative" 
        style={{ zIndex: Z_INDEX_MODAL_CONTENT }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-gray-900">Admin Login</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="size-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Login to access admin features including review and approval of location
            updates.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="size-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@foresight.org"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1 text-gray-900 font-medium"
              style={{
                background: activeMultiGradient,
              }}
            >
              Log in
            </Button>
          </div>

          <p className="text-xs text-gray-500 pt-2">
            Default credentials: admin@foresight.org / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
