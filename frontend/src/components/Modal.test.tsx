import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Modal } from './Modal'

/**
 * Mirrors how the pages use Modal: a controlled field, so every keystroke re-renders the parent
 * and hands Modal a fresh inline onClose.
 */
function Harness({ onClose }: { onClose: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      {isOpen && (
        <Modal
          title="Edit task"
          onClose={() => {
            setIsOpen(false)
            onClose()
          }}
        >
          <label htmlFor="field">Field</label>
          <input id="field" value={value} onChange={(e) => setValue(e.target.value)} />
          <button>Save</button>
        </Modal>
      )}
    </>
  )
}

describe('Modal', () => {
  it('is a labelled dialog', async () => {
    render(<Harness onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(screen.getByRole('dialog', { name: 'Edit task' })).toHaveAttribute(
      'aria-modal',
      'true',
    )
  })

  it('focuses the first field so the form can be typed into immediately', async () => {
    render(<Harness onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(screen.getByLabelText('Field')).toHaveFocus()
  })

  // Regression: the focus effect depended on onClose, which callers pass as an inline arrow. Each
  // keystroke re-rendered the parent, re-ran the effect, and pulled focus off the field — so only
  // the first character ever landed and the form looked broken.
  it('keeps focus in the field across keystrokes', async () => {
    render(<Harness onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    const field = screen.getByLabelText('Field')
    await userEvent.type(field, 'Payments')

    expect(field).toHaveValue('Payments')
    expect(field).toHaveFocus()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('returns focus to whatever opened it', async () => {
    render(<Harness onClose={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    await userEvent.click(trigger)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(trigger).toHaveFocus()
  })

  it('keeps Tab inside the dialog', async () => {
    render(<Harness onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    const dialog = screen.getByRole('dialog')
    const inside = [
      screen.getByRole('button', { name: 'Close' }),
      screen.getByLabelText('Field'),
      screen.getByRole('button', { name: 'Save' }),
    ]

    // One full cycle plus one, so the wrap-around at the end is exercised.
    for (let i = 0; i < inside.length + 1; i += 1) {
      await userEvent.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it('closes on a backdrop press but not on a press inside the panel', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    await userEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    // The backdrop is the dialog's parent element.
    await userEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalled()
  })
})
