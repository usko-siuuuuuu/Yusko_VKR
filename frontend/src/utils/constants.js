export const STATUS_LABELS = {
  issued:               'Выдано',
  in_progress:          'В работе',
  on_review_supervisor: 'На проверке у технадзора',
  on_review_client:     'На проверке у заказчика',
  rework:               'На доработку',
  closed:               'Закрыто',
}

export const STATUS_COLORS = {
  issued:               '#6366f1',
  in_progress:          '#f59e0b',
  on_review_supervisor: '#3b82f6',
  on_review_client:     '#8b5cf6',
  rework:               '#ef4444',
  closed:               '#10b981',
}

export const ISSUE_TYPE_LABELS = {
  type1: 'Тип 1 — Технадзор → Прораб',
  type2: 'Тип 2 — Заказчик → Генподрядчик',
}

export const ROLE_LABELS = {
  admin:      'Администратор',
  client_rep: 'Представитель заказчика',
  supervisor: 'Технадзор',
  foreman:    'Прораб',
}

export const ORG_TYPE_LABELS = {
  customer:           'Заказчик',
  general_contractor: 'Генподрядчик',
  subcontractor:      'Подрядная организация',
}