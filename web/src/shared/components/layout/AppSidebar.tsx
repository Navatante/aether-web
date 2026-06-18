// shared/components/layout/AppSidebar.tsx
import { NavLink, useLocation } from "react-router-dom"
import {
    Home,
    FileText,
    ChevronDown,
    Award,
    TicketsIcon,
    Users,
    BaggageClaimIcon,
    Puzzle,
    Scale,
    BicepsFlexed,
    UserRoundCog,
    UserRoundCheck,
    School,
    ClipboardClock,
    Fuel,
    LucideIcon,
} from "lucide-react"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarSeparator,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ConnectionIndicatorSidebar } from "./ConnectionIndicatorSidebar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Types for navigation items
type SubItem = {
    title: string
    href: string
}

type NavItemSimple = {
    title: string
    href: string
    icon: LucideIcon
}

type NavItemWithSubType = {
    title: string
    icon: LucideIcon
    subItems: SubItem[]
}

type NavItemType = NavItemSimple | NavItemWithSubType

const mainNavItems: NavItemType[] = [
    {
        title: "Escuadrilla",
        href: "/",
        icon: Home,
    },
    {
        title: "Pilotos",
        icon: UserRoundCheck,
        subItems: [
            { title: "Horas de vuelo", href: "/pilotos/horas-vuelo" },
            { title: "Tomas y aproximaciones", href: "/pilotos/tomas-aproximaciones" },
            { title: "Instrucción", href: "/pilotos/instruccion" },
            { title: "Adiestramiento", href: "/pilotos/adiestramiento" },
        ],
    },
    {
        title: "Dotaciones",
        icon: UserRoundCog,
        subItems: [
            { title: "Horas de vuelo", href: "/dotaciones/horas-vuelo" },
            { title: "Proyectiles", href: "/dotaciones/proyectiles" },
            { title: "Instrucción", href: "/dotaciones/instruccion" },
            { title: "Adiestramiento", href: "/dotaciones/adiestramiento" },
        ],
    },
    {
        title: "Vuelos",
        href: "/flights",
        icon: FileText,
    },
    {
        title: "Ground school",
        href: "/ground-school",
        icon: School,
    },
]

const middleNavItems: NavItemType[] = [
    { title: "Horas extra otros modelos", href: "/horasExtraOtrosModelos", icon: ClipboardClock },
    { title: "Papeletas", href: "/papeletas", icon: TicketsIcon },
    {
        title: "Calificaciones",
        icon: Award,
        subItems: [
            { title: "Modelo", href: "/calificaciones/modelRatings" },
            { title: "Operativas", href: "/calificaciones/operationalRatings" },
            { title: "Generales y Tácticas", href: "/calificaciones/generalTacticalRatings" },
            { title: "Mando y Liderazgo", href: "/calificaciones/leadershipRatings" },
            { title: "Mantenimiento", href: "/calificaciones/maintenanceRatings" },
        ],
    },
    { title: "Combustible", href: "/combustible", icon: Fuel },
]

const bottomNavItems: NavItemType[] = [
    { title: "Personal", href: "/personnel", icon: Users },
    { title: "Comisiones", href: "/comisiones", icon: BaggageClaimIcon },
    { title: "Días de comisión", href: "/diasDeComision", icon: Scale },
    { title: "Esfuerzo", href: "/esfuerzo", icon: BicepsFlexed },
    { title: "Disponibilidad", href: "/disponibilidad", icon: Puzzle },
]

// Type guard to check if item has subItems
function hasSubItems(item: NavItemType): item is NavItemWithSubType {
    return "subItems" in item && Array.isArray(item.subItems)
}

// Componente para modo colapsado (DropdownMenu)
function CollapsedNavItem({
    item,
    currentPath,
}: {
    item: NavItemWithSubType
    currentPath: string
}) {
    const Icon = item.icon
    return (
        <SidebarMenuItem>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={(props) => (
                        <SidebarMenuButton {...props} tooltip={item.title}>
                            <Icon />
                        </SidebarMenuButton>
                    )}
                />
                <DropdownMenuContent side="right" align="start">
                    {item.subItems.map((subItem) => (
                        <DropdownMenuItem
                            key={subItem.href}
                            render={(props) => (
                                <NavLink
                                    {...props}
                                    to={subItem.href}
                                    className={`${props.className} text-foreground ${currentPath === subItem.href ? "bg-accent" : ""}`}
                                >
                                    {subItem.title}
                                </NavLink>
                            )}
                        />
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </SidebarMenuItem>
    )
}

// Componente para modo expandido (Collapsible)
function ExpandedNavItem({
    item,
    currentPath,
    isSubActive,
}: {
    item: NavItemWithSubType
    currentPath: string
    isSubActive: boolean
}) {
    const Icon = item.icon
    return (
        <Collapsible defaultOpen={isSubActive} className="group/collapsible">
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.title}>
                        <Icon />
                        <span>{item.title}</span>
                        <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {item.subItems.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.href}>
                                <SidebarMenuSubButton
                                    asChild
                                    isActive={currentPath === subItem.href}
                                >
                                    <NavLink to={subItem.href}>
                                        <span>{subItem.title}</span>
                                    </NavLink>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    )
}

// Componente para items con submenú - Usa CSS para toggle sin unmount/remount
function NavItemWithSub({
    item,
}: {
    item: NavItemWithSubType
}) {
    const location = useLocation()
    const currentPath = location.pathname

    // Check if any sub-item is active for default open state
    const isSubActive = item.subItems.some((sub) => currentPath === sub.href)

    return (
        <>
            {/* Collapsed mode: shown when sidebar has data-collapsible="icon" */}
            <div className="hidden group-data-[collapsible=icon]:block">
                <CollapsedNavItem item={item} currentPath={currentPath} />
            </div>
            {/* Expanded mode: hidden when sidebar has data-collapsible="icon" */}
            <div className="group-data-[collapsible=icon]:hidden">
                <ExpandedNavItem item={item} currentPath={currentPath} isSubActive={isSubActive} />
            </div>
        </>
    )
}

// Componente para items simples (sin submenú)
function NavItem({ item }: { item: NavItemSimple }) {
    const location = useLocation()
    const isActive = location.pathname === item.href
    const Icon = item.icon

    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                <NavLink to={item.href}>
                    <Icon />
                    <span>{item.title}</span>
                </NavLink>
            </SidebarMenuButton>
        </SidebarMenuItem>
    )
}

// Componente que renderiza una lista de items
function NavGroup({
    items,
}: {
    items: NavItemType[]
}) {
    return (
        <SidebarMenu>
            {items.map((item) =>
                hasSubItems(item) ? (
                    <NavItemWithSub key={item.title} item={item} />
                ) : (
                    <NavItem key={item.title} item={item} />
                )
            )}
        </SidebarMenu>
    )
}

// Main sidebar component - No longer needs useSidebar since CSS handles visibility
export function AppSidebar() {
    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="border-b-1 border-secondary p-1 ">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <div className="flex justify-between m-1.5">
                            <span className="text-foreground text-sm font-medium pt-1 ml-3 group-data-[collapsible=icon]:hidden">
                                Menú principal
                            </span>
                            <SidebarTrigger className="cursor-pointer" />
                        </div>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="overflow-x-hidden">
                {/* Main Navigation */}
                <SidebarGroup>
                    <SidebarGroupContent>
                        <NavGroup items={mainNavItems} />
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarSeparator />

                {/* Middle Navigation */}
                <SidebarGroup>
                    <SidebarGroupContent>
                        <NavGroup items={middleNavItems} />
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarSeparator />

                {/* Bottom Navigation */}
                <SidebarGroup>
                    <SidebarGroupContent>
                        <NavGroup items={bottomNavItems} />
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t-1 border-secondary">
                <ConnectionIndicatorSidebar />
            </SidebarFooter>
        </Sidebar>
    )
}