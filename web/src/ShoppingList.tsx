import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Menu, Trash2 } from 'lucide-react';
import type { ShoppingItem } from './types';

interface Props {
  items: ShoppingItem[];
  onReorder: (items: ShoppingItem[]) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

export function ShoppingList({ items, onReorder, onToggle, onRemove }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const finishDrag = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex(item => item.id === active.id);
    const to = items.findIndex(item => item.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  };
  const nameOf = (id: string | number) => items.find(item => item.id === id)?.name ?? '食材';

  return <div className="shopping-list">
    {items.length > 1 && <p className="shopping-order-hint">左の三本線をつかんで上下に並べ替えられます。</p>}
    {items.length === 0 && <div className="empty">まだ買うものがありません。</div>}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={finishDrag}
      accessibility={{
        screenReaderInstructions: { draggable: 'スペースキーでつかみ、上下矢印キーで移動、スペースキーで確定します。Escapeキーで取り消します。' },
        announcements: {
          onDragStart: ({ active }) => `${nameOf(active.id)}をつかみました。`,
          onDragOver: ({ active, over }) => over ? `${nameOf(active.id)}を${items.findIndex(item => item.id === over.id) + 1}番目へ移動します。` : undefined,
          onDragEnd: ({ active, over }) => over ? `${nameOf(active.id)}を${items.findIndex(item => item.id === over.id) + 1}番目に移動しました。` : '並べ替えを取り消しました。',
          onDragCancel: () => '並べ替えを取り消しました。',
        },
      }}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map(item => <ShoppingRow key={item.id} item={item} onToggle={onToggle} onRemove={onRemove} />)}
      </SortableContext>
    </DndContext>
  </div>;
}

function ShoppingRow({ item, onToggle, onRemove }: Pick<Props, 'onToggle' | 'onRemove'> & { item: ShoppingItem }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null), transition }}
    className={`shopping-row ${item.checked ? 'done' : ''} ${isDragging ? 'dragging' : ''}`}>
    <button ref={setActivatorNodeRef} type="button" className="shopping-drag-handle" {...attributes} {...listeners}
      aria-label={`${item.name}を並べ替え`} aria-roledescription="並べ替えハンドル" title="つかんで上下に移動"><Menu size={21} /></button>
    <button className="check-button" aria-label={`${item.name}を${item.checked ? '未購入' : '購入済み'}にする`} aria-pressed={item.checked} onClick={() => onToggle(item.id)}>{item.checked && <Check size={17} />}</button>
    <div><b>{item.name}</b><span>{item.source === 'auto' ? '献立から' : '手動追加'}</span></div>
    <button className="trash" aria-label={`${item.name}を削除`} onClick={() => onRemove(item.id)}><Trash2 size={17} /></button>
  </div>;
}
