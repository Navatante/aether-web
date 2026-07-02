// Diálogos de gestión del catálogo de lugares de comisión (añadir, listar,
// editar, confirmar borrado). Solo render: estado y handlers vienen de
// useComisionForm a través de RegisterComisionForm.

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";

interface Lugar {
    comision_lugar_sk: number;
    comision_name: string;
}

export interface LugaresDialogsProps {
    lugarArray: Lugar[] | undefined;
    lugarLoading: boolean;
    isAddLugarOpen: boolean;
    isManageLugaresOpen: boolean;
    setIsManageLugaresOpen: (open: boolean) => void;
    isEditLugarOpen: boolean;
    isDeleteConfirmOpen: boolean;
    newLugarName: string;
    setNewLugarName: (name: string) => void;
    editingLugar: Lugar | null;
    setEditingLugar: (lugar: Lugar) => void;
    lugarToDelete: Lugar | null;
    lugarError: string;
    setLugarError: (msg: string) => void;
    insertLoading: boolean;
    deleteLoading: boolean;
    closeAddLugarDialog: () => void;
    closeEditLugarDialog: () => void;
    closeDeleteConfirmDialog: () => void;
    openEditDialog: (lugar: Lugar) => void;
    openDeleteConfirm: (lugar: Lugar) => void;
    handleAddLugar: () => void;
    handleEditLugar: () => void;
    handleDeleteLugar: () => void;
}

export default function LugaresDialogs({
    lugarArray,
    lugarLoading,
    isAddLugarOpen,
    isManageLugaresOpen,
    setIsManageLugaresOpen,
    isEditLugarOpen,
    isDeleteConfirmOpen,
    newLugarName,
    setNewLugarName,
    editingLugar,
    setEditingLugar,
    lugarToDelete,
    lugarError,
    setLugarError,
    insertLoading,
    deleteLoading,
    closeAddLugarDialog,
    closeEditLugarDialog,
    closeDeleteConfirmDialog,
    openEditDialog,
    openDeleteConfirm,
    handleAddLugar,
    handleEditLugar,
    handleDeleteLugar,
}: LugaresDialogsProps) {
    return (
        <>
            <Dialog open={isAddLugarOpen} onOpenChange={closeAddLugarDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Agregar nuevo lugar</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-lugar-name">Nombre del lugar</Label>
                            <Input
                                id="new-lugar-name"
                                value={newLugarName}
                                onChange={(e) => {
                                    setNewLugarName(e.target.value);
                                    setLugarError('');
                                }}
                                placeholder="Ingrese el nombre del lugar"
                                className={lugarError ? 'border-danger' : ''}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddLugar();
                                    }
                                }}
                            />
                            {lugarError && (
                                <p className="text-sm text-danger">{lugarError}</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeAddLugarDialog}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={handleAddLugar} disabled={insertLoading}>
                            {insertLoading ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isManageLugaresOpen} onOpenChange={setIsManageLugaresOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Gestionar lugares</DialogTitle>
                        <DialogDescription>
                            Edita o elimina los lugares existentes
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 max-h-[400px] overflow-y-auto">
                        {lugarLoading ? (
                            <p className="text-center text-muted-foreground">Cargando...</p>
                        ) : lugarArray && lugarArray.length > 0 ? (
                            <div className="space-y-2">
                                {lugarArray.map((lugar) => (
                                    <div
                                        key={lugar.comision_lugar_sk}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                    >
                                        <span className="text-sm font-medium">{lugar.comision_name}</span>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                onClick={() => openEditDialog(lugar)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => openDeleteConfirm(lugar)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground">No hay lugares disponibles</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsManageLugaresOpen(false)}>
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditLugarOpen} onOpenChange={closeEditLugarDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Editar lugar</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-lugar-name">Nombre del lugar</Label>
                            <Input
                                id="edit-lugar-name"
                                value={editingLugar?.comision_name || ''}
                                onChange={(e) => {
                                    if (editingLugar) {
                                        setEditingLugar({
                                            ...editingLugar,
                                            comision_name: e.target.value
                                        });
                                    }
                                    setLugarError('');
                                }}
                                placeholder="Ingrese el nombre del lugar"
                                className={lugarError ? 'border-danger' : ''}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleEditLugar();
                                    }
                                }}
                            />
                            {lugarError && (
                                <p className="text-sm text-danger">{lugarError}</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeEditLugarDialog}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={handleEditLugar} disabled={insertLoading}>
                            {insertLoading ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteConfirmOpen} onOpenChange={closeDeleteConfirmDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Confirmar eliminación</DialogTitle>
                        <DialogDescription>
                            ¿Estás seguro de que deseas eliminar el lugar "{lugarToDelete?.comision_name}"?
                            Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={closeDeleteConfirmDialog}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDeleteLugar}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? 'Eliminando...' : 'Eliminar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
