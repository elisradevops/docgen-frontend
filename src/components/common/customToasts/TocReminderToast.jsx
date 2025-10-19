import React from 'react';

/**
 * Generic toast notification content component with structured layout
 * Displays a title, optional description, list of items, and an optional tip
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Main title of the notification
 * @param {string} props.description - Optional description text
 * @param {Array<string>} props.items - Optional list of items to display
 * @param {string} props.tip - Optional tip text (supports HTML)
 * @param {string} props.icon - Optional emoji/icon for the title
 * @param {string} props.tipIcon - Optional emoji/icon for the tip
 */
const TocReminderToast = ({
  title,
  description,
  items,
  tip,
  icon,
  tipIcon,
}) => (
  <div>
    {title && (
      <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '15px' }}>
        {icon && `${icon} `}{title}
      </div>
    )}
    {description && (
      <div style={{ fontSize: '13px', lineHeight: '1.5', marginBottom: '8px' }}>
        {description}
      </div>
    )}
    {items && items.length > 0 && (
      <ul style={{ margin: '0 0 8px 0', paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6' }}>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    )}
    {tip && (
      <div 
        style={{ fontSize: '12px', opacity: 0.9, fontStyle: 'italic' }}
        dangerouslySetInnerHTML={{ __html: `${tipIcon ? `${tipIcon} ` : ''}${tip}` }}
      />
    )}
  </div>
);

export default TocReminderToast;
