import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Images,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Link2,
  Calendar,
  CheckCircle,
  XCircle,
  Upload,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ManagementHub from '../components/common/ManagementHub';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import SelectField from '../components/common/SelectField';
import { PageContentSkeleton } from '../components/SkeletonComponent';
import apiCall, { uploadFile } from '../utils/apiCall';

const LINK_TYPE_OPTIONS = [
  { value: 'none', label: 'Not clickable' },
  { value: 'internal', label: 'Internal screen' },
  { value: 'service', label: 'Service details' },
  { value: 'external', label: 'External URL' },
];

const INTERNAL_ROUTE_OPTIONS = [
  { value: 'home', label: 'Home' },
  { value: 'services', label: 'Services' },
  { value: 'orders', label: 'Orders' },
  { value: 'firms', label: 'Businesses' },
  { value: 'documents', label: 'Documents' },
  { value: 'account', label: 'Account' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const EMPTY_FORM = {
  title: '',
  image: '',
  link_type: 'none',
  link_value: '',
  status: 'active',
  starts_at: '',
  expires_at: '',
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toInputDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const linkSummary = (slide) => {
  if (!slide?.link_type || slide.link_type === 'none') return 'Not clickable';
  if (slide.link_type === 'internal') return `Internal · ${slide.link_value || '—'}`;
  if (slide.link_type === 'service') return `Service · ${slide.link_value || '—'}`;
  return `External · ${slide.link_value || '—'}`;
};

const StatusBadge = ({ status }) => {
  const active = status === 'active';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
          : 'border-gray-200 bg-gray-100 text-gray-600'
      }`}
    >
      {active ? <CheckCircle size={10} /> : <XCircle size={10} />}
      {active ? 'Active' : 'Inactive'}
    </span>
  );
};

export default function HomeCarousel() {
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [slides, setSlides] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [reordering, setReordering] = useState(false);
  const fileInputRef = useRef(null);
  const isFetching = useRef(false);
  const slidesRef = useRef([]);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  const fetchData = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    setLoading(true);
    try {
      const response = await apiCall('/api/admin/home-carousel/list');
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.message || 'Failed to load carousel');
      }
      setEnabled(Boolean(body.data?.settings?.is_enabled));
      setSlides(body.data?.slides || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load carousel');
    } finally {
      isFetching.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (slide) => {
    setEditing(slide);
    setForm({
      title: slide.title || '',
      image: slide.image || '',
      link_type: slide.link_type || 'none',
      link_value: slide.link_value || '',
      status: slide.status || 'active',
      starts_at: toInputDateTime(slide.starts_at),
      expires_at: toInputDateTime(slide.expires_at),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving || uploading) return;
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleToggleEnabled = async () => {
    const next = !enabled;
    setSavingSettings(true);
    try {
      const response = await apiCall('/api/admin/home-carousel/settings', 'POST', {
        is_enabled: next,
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.message || 'Failed to update settings');
      }
      setEnabled(next);
      toast.success(next ? 'Carousel enabled' : 'Carousel disabled');
    } catch (error) {
      toast.error(error.message || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleImagePick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setForm((prev) => ({ ...prev, image: url }));
      toast.success('Image uploaded');
    } catch (error) {
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.image) {
      toast.error('Please upload a 16:9 image (1200×675 recommended)');
      return;
    }
    if (form.link_type !== 'none' && !String(form.link_value || '').trim()) {
      toast.error('Please provide a link value');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim() || null,
        image: form.image,
        link_type: form.link_type,
        link_value: form.link_type === 'none' ? null : form.link_value.trim(),
        status: form.status,
        starts_at: form.starts_at || null,
        expires_at: form.expires_at || null,
      };

      const endpoint = editing
        ? '/api/admin/home-carousel/update'
        : '/api/admin/home-carousel/create';
      const bodyPayload = editing ? { ...payload, slide_id: editing.slide_id } : payload;

      const response = await apiCall(endpoint, 'POST', bodyPayload);
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.message || 'Failed to save slide');
      }

      toast.success(editing ? 'Slide updated' : 'Slide created');
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to save slide');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await apiCall('/api/admin/home-carousel/delete', 'POST', {
        slide_id: deleteTarget.slide_id,
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.message || 'Failed to delete slide');
      }
      toast.success('Slide deleted');
      setDeleteTarget(null);
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to delete slide');
    } finally {
      setDeleting(false);
    }
  };

  const persistOrder = async (nextSlides) => {
    setReordering(true);
    try {
      const response = await apiCall('/api/admin/home-carousel/reorder', 'POST', {
        slide_ids: nextSlides.map((slide) => slide.slide_id),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.message || 'Failed to reorder slides');
      }
      toast.success('Order saved');
    } catch (error) {
      toast.error(error.message || 'Failed to reorder slides');
      fetchData();
    } finally {
      setReordering(false);
    }
  };

  const onDragStart = (index) => setDragIndex(index);

  const onDragOver = (event, index) => {
    event.preventDefault();
    if (dragIndex == null || dragIndex === index) return;
    setSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(index);
  };

  const onDragEnd = () => {
    if (dragIndex == null) return;
    setDragIndex(null);
    persistOrder(slidesRef.current);
  };

  if (loading) {
    return <PageContentSkeleton />;
  }

  return (
    <ManagementHub
      title="Home Carousel"
      description="Manage homepage banner slides. Use 16:9 images (1200×675 recommended)."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <Button onClick={openCreate} className="inline-flex items-center gap-2">
            <Plus size={16} />
            Add slide
          </Button>
        </div>
      }
    >
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
            <Images size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Carousel visibility</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              When disabled, the carousel is hidden on client Home even if slides exist.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={savingSettings}
          onClick={handleToggleEnabled}
          className={`relative h-8 w-14 rounded-full transition ${
            enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
          } ${savingSettings ? 'opacity-60' : ''}`}
          aria-pressed={enabled}
          aria-label="Toggle carousel"
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
              enabled ? 'left-7' : 'left-1'
            }`}
          />
        </button>
      </div>

      {slides.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
          <Images className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">No slides yet</p>
          <p className="mt-1 text-xs text-gray-500">Add a slide to show banners on the client Home page.</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={15} />
            Add slide
          </button>
        </div>
      ) : (
        <div className={`space-y-3 ${reordering ? 'opacity-70' : ''}`}>
          {slides.map((slide, index) => (
            <div
              key={slide.slide_id}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(event) => onDragOver(event, index)}
              onDragEnd={onDragEnd}
              className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3 sm:w-auto">
                <button
                  type="button"
                  className="cursor-grab rounded-lg p-2 text-gray-400 hover:bg-gray-100 active:cursor-grabbing dark:hover:bg-gray-800"
                  aria-label="Drag to reorder"
                >
                  <GripVertical size={18} />
                </button>
                <div className="h-20 w-36 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                  {slide.image ? (
                    <img src={slide.image} alt={slide.title || 'Slide'} className="h-full w-full object-cover" />
                  ) : null}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {slide.title || 'Untitled slide'}
                  </p>
                  <StatusBadge status={slide.status} />
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                  <Link2 size={12} />
                  {linkSummary(slide)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                  <Calendar size={12} />
                  {formatDateTime(slide.starts_at)} → {formatDateTime(slide.expires_at)}
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => openEdit(slide)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200"
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(slide)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit slide' : 'Add slide'}
        icon={Images}
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
            >
              Cancel
            </button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create slide'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Title (optional)
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800"
              placeholder="Admin label / optional overlay"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Image (16:9)
            </label>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
              <div className="aspect-[16/9] w-full">
                {form.image ? (
                  <img src={form.image} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">
                    No image selected
                  </div>
                )}
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200"
            >
              <Upload size={15} />
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Link type
              </label>
              <SelectField
                value={LINK_TYPE_OPTIONS.find((o) => o.value === form.link_type) || LINK_TYPE_OPTIONS[0]}
                onChange={(option) =>
                  setForm((prev) => ({
                    ...prev,
                    link_type: option?.value || 'none',
                    link_value: option?.value === 'none' ? '' : prev.link_value,
                  }))
                }
                options={LINK_TYPE_OPTIONS}
                isClearable={false}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
              </label>
              <SelectField
                value={STATUS_OPTIONS.find((o) => o.value === form.status) || STATUS_OPTIONS[0]}
                onChange={(option) => setForm((prev) => ({ ...prev, status: option?.value || 'active' }))}
                options={STATUS_OPTIONS}
                isClearable={false}
              />
            </div>
          </div>

          {form.link_type === 'internal' ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Internal screen
              </label>
              <SelectField
                value={INTERNAL_ROUTE_OPTIONS.find((o) => o.value === form.link_value) || null}
                onChange={(option) => setForm((prev) => ({ ...prev, link_value: option?.value || '' }))}
                options={INTERNAL_ROUTE_OPTIONS}
                placeholder="Select screen"
                isClearable={false}
              />
            </div>
          ) : null}

          {form.link_type === 'service' ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Service ID
              </label>
              <input
                type="text"
                value={form.link_value}
                onChange={(e) => setForm((prev) => ({ ...prev, link_value: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800"
                placeholder="Paste service_id"
              />
            </div>
          ) : null}

          {form.link_type === 'external' ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                External URL
              </label>
              <input
                type="url"
                value={form.link_value}
                onChange={(e) => setForm((prev) => ({ ...prev, link_value: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800"
                placeholder="https://example.com"
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Starts at (optional)
              </label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm((prev) => ({ ...prev, starts_at: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Expires at (optional)
              </label>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm((prev) => ({ ...prev, expires_at: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => (!deleting ? setDeleteTarget(null) : null)}
        title="Delete slide"
        icon={Trash2}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Delete “{deleteTarget?.title || 'this slide'}”? This cannot be undone.
        </p>
      </Modal>
    </ManagementHub>
  );
}
