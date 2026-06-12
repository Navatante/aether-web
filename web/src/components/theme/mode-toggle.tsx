import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button.tsx"
import { useTheme } from "@/components/theme/theme-provider.tsx"

export function ModeToggle() {
    const { theme, setTheme } = useTheme()

    const toggleTheme = () => {

        if (theme === 'dark') {
            setTheme('light')
        } else if (theme === 'light') {
            setTheme('dark')
        } else {
            // Si es 'system', ir a light primero
            setTheme('light')
        }
    }

    return (
        <Button variant="outline" size="icon" onClick={toggleTheme}>
            <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}