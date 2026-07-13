'use client'

import { useEffect, useState } from 'react'
import SiteHeader from '../components/SiteHeader'
import styles from './page.module.css'
import {
  SavedVendor,
  deleteSavedVendor,
  insertSavedVendor,
  loadSavedVendors,
  updateSavedVendor,
} from '../lib/events'

const CATEGORIES = [
  'Florists',
  'Caterers',
  'Party Equipment Rental',
  'DJs & Entertainment',
  'Photographers',
  'Videographers',
  'Wedding Planners',
  'Bakeries & Cakes',
  'Bartending Services',
  'Lighting & AV',
  'Transportation',
  'Venues (Competitors)',
]

const PRICE_RANGES = ['$', '$$', '$$$', '$$$$']

export default function VendorsPage() {
  const [savedVendors, setSavedVendors] = useState<SavedVendor[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingVendor, setEditingVendor] = useState<SavedVendor | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    phone: '',
    website: '',
    address: '',
    priceRange: '',
    notes: '',
  })

  useEffect(() => {
    loadSavedVendors().then(setSavedVendors)
  }, [])

  // Get categories that have vendors
  const usedCategories = [...new Set(savedVendors.map((v) => v.category))].sort()

  const handleAddVendor = async () => {
    if (!formData.name.trim() || !formData.category) return

    const newVendor: SavedVendor = {
      id: `vendor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: formData.name.trim(),
      category: formData.category,
      description: formData.description.trim(),
      phone: formData.phone.trim(),
      website: formData.website.trim(),
      address: formData.address.trim(),
      priceRange: formData.priceRange,
      notes: formData.notes.trim(),
      savedAt: new Date().toISOString(),
    }

    try {
      await insertSavedVendor(newVendor)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed')
      return
    }
    setSavedVendors([...savedVendors, newVendor])
    resetForm()
    setShowAddForm(false)
  }

  const handleUpdateVendor = async () => {
    if (!editingVendor || !formData.name.trim() || !formData.category) return

    const updatedVendor: SavedVendor = {
      ...editingVendor,
      name: formData.name.trim(),
      category: formData.category,
      description: formData.description.trim(),
      phone: formData.phone.trim(),
      website: formData.website.trim(),
      address: formData.address.trim(),
      priceRange: formData.priceRange,
      notes: formData.notes.trim(),
    }

    try {
      await updateSavedVendor(updatedVendor)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed')
      return
    }
    setSavedVendors(
      savedVendors.map((v) => (v.id === editingVendor.id ? updatedVendor : v)),
    )
    resetForm()
    setEditingVendor(null)
    setShowAddForm(false)
  }

  const handleDeleteVendor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return
    try {
      await deleteSavedVendor(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
      return
    }
    setSavedVendors(savedVendors.filter((v) => v.id !== id))
  }

  const startEditVendor = (vendor: SavedVendor) => {
    setFormData({
      name: vendor.name,
      category: vendor.category,
      description: vendor.description,
      phone: vendor.phone,
      website: vendor.website,
      address: vendor.address,
      priceRange: vendor.priceRange,
      notes: vendor.notes,
    })
    setEditingVendor(vendor)
    setShowAddForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      description: '',
      phone: '',
      website: '',
      address: '',
      priceRange: '',
      notes: '',
    })
    setEditingVendor(null)
  }

  const filteredVendors =
    activeCategory === 'All'
      ? savedVendors
      : savedVendors.filter((v) => v.category === activeCategory)

  // Group vendors by category for display
  const vendorsByCategory = filteredVendors.reduce((acc, vendor) => {
    if (!acc[vendor.category]) acc[vendor.category] = []
    acc[vendor.category].push(vendor)
    return acc
  }, {} as Record<string, SavedVendor[]>)

  const sortedCategories = Object.keys(vendorsByCategory).sort()

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <SiteHeader />

        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderLeft}>
            <h1 className={styles.pageTitle}>Vendor Directory</h1>
            <span className={styles.vendorCount}>{savedVendors.length} vendors</span>
          </div>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => {
              resetForm()
              setShowAddForm(!showAddForm)
            }}
          >
            {showAddForm ? 'Cancel' : 'Add Vendor'}
          </button>
        </div>

        {showAddForm && (
          <section className={styles.formSection}>
            <h2 className={styles.formTitle}>
              {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
            </h2>
            <div className={styles.addForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Vendor Name *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Memphis Florist Co."
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Category *</label>
                  <select
                    className={styles.formSelect}
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Phone</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(901) 555-1234"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Website</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Location</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g., Midtown Memphis"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Price Range</label>
                  <select
                    className={styles.formSelect}
                    value={formData.priceRange}
                    onChange={(e) => setFormData({ ...formData, priceRange: e.target.value })}
                  >
                    <option value="">Select range</option>
                    {PRICE_RANGES.map((range) => (
                      <option key={range} value={range}>
                        {range}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description</label>
                <textarea
                  className={styles.formTextarea}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What services do they offer?"
                  rows={2}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Notes</label>
                <textarea
                  className={styles.formTextarea}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Personal notes, contact person, etc."
                  rows={2}
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => {
                    resetForm()
                    setShowAddForm(false)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={editingVendor ? handleUpdateVendor : handleAddVendor}
                  disabled={!formData.name.trim() || !formData.category}
                >
                  {editingVendor ? 'Update Vendor' : 'Save Vendor'}
                </button>
              </div>
            </div>
          </section>
        )}

        {savedVendors.length > 0 && (
          <div className={styles.filterBar}>
            <span className={styles.filterLabel}>Filter by category:</span>
            <div className={styles.filterList}>
              <button
                type="button"
                className={`${styles.filterBtn} ${activeCategory === 'All' ? styles.filterBtnActive : ''}`}
                onClick={() => setActiveCategory('All')}
              >
                All
              </button>
              {usedCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`${styles.filterBtn} ${activeCategory === category ? styles.filterBtnActive : ''}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category} ({savedVendors.filter((v) => v.category === category).length})
                </button>
              ))}
            </div>
          </div>
        )}

        {savedVendors.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No vendors saved yet.</p>
            <p>Click "Add Vendor" to start building your directory.</p>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No vendors in this category.</p>
          </div>
        ) : (
          <div className={styles.vendorSections}>
            {sortedCategories.map((category) => (
              <section key={category} className={styles.categorySection}>
                <h2 className={styles.categoryTitle}>{category}</h2>
                <div className={styles.vendorGrid}>
                  {vendorsByCategory[category].map((vendor) => (
                    <div key={vendor.id} className={styles.vendorCard}>
                      <div className={styles.vendorHeader}>
                        <h3 className={styles.vendorName}>{vendor.name}</h3>
                        {vendor.priceRange && (
                          <span className={styles.vendorPrice}>{vendor.priceRange}</span>
                        )}
                      </div>
                      {vendor.description && (
                        <p className={styles.vendorDescription}>{vendor.description}</p>
                      )}
                      <div className={styles.vendorDetails}>
                        {vendor.address && (
                          <div className={styles.vendorDetail}>
                            <span className={styles.detailLabel}>Location</span>
                            <span className={styles.detailValue}>{vendor.address}</span>
                          </div>
                        )}
                        {vendor.phone && (
                          <div className={styles.vendorDetail}>
                            <span className={styles.detailLabel}>Phone</span>
                            <span className={styles.detailValue}>{vendor.phone}</span>
                          </div>
                        )}
                        {vendor.notes && (
                          <div className={styles.vendorDetail}>
                            <span className={styles.detailLabel}>Notes</span>
                            <span className={styles.detailValue}>{vendor.notes}</span>
                          </div>
                        )}
                      </div>
                      <div className={styles.vendorActions}>
                        {vendor.website ? (
                          <a
                            href={
                              vendor.website.startsWith('http')
                                ? vendor.website
                                : `https://${vendor.website}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.vendorLink}
                          >
                            Website
                          </a>
                        ) : (
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(
                              vendor.name + ' Memphis TN'
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.vendorLink}
                          >
                            Search
                          </a>
                        )}
                        <button
                          type="button"
                          className={styles.editBtn}
                          onClick={() => startEditVendor(vendor)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.removeBtn}
                          onClick={() => handleDeleteVendor(vendor.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
