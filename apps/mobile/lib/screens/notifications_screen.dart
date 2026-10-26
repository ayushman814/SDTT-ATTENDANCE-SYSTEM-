import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/app_widgets.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final unread = state.unreadCount;

    return RefreshIndicator(
      onRefresh: state.retryHome,
      color: AppColors.primary,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          // Header Info
          FadeSlideIn(
            offsetY: 16,
            child: AppCard(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.notifications_active_rounded,
                      color: AppColors.primary,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          unread > 0
                              ? '$unread Unread Notification${unread == 1 ? "" : "s"}'
                              : 'All caught up!',
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                            color: AppColors.ink,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Direct private in-app updates. Zero email/SMS spam.',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.slate,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 18),

          if (state.notifications.isEmpty)
            const FadeSlideIn(
              delay: Duration(milliseconds: 60),
              child: EmptyState(
                icon: Icons.mark_email_read_outlined,
                title: 'No notifications',
                message:
                    'When a teacher finalizes an attendance session, an alert will appear here.',
              ),
            ),

          ...state.notifications.asMap().entries.map((entry) {
            final index = entry.key;
            final item = entry.value;

            return FadeSlideIn(
              delay: Duration(milliseconds: 60 + index * 40),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _NotificationCard(
                  item: item,
                  onRead: () => state.markNotificationRead(item),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.item, required this.onRead});
  final AppNotification item;
  final VoidCallback onRead;

  @override
  Widget build(BuildContext context) {
    return AnimatedPressable(
      onTap: item.read ? null : onRead,
      child: AppCard(
        padding: const EdgeInsets.all(16),
        borderColor: item.read ? AppColors.border : AppColors.primaryLight,
        backgroundColor: item.read ? AppColors.card : Colors.white,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: item.read
                    ? AppColors.cardSubtle
                    : AppColors.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                item.read
                    ? Icons.notifications_none_rounded
                    : Icons.notifications_rounded,
                size: 20,
                color: item.read ? AppColors.muted : AppColors.primary,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: item.read ? FontWeight.w600 : FontWeight.w800,
                            color: item.read ? AppColors.slate : AppColors.ink,
                          ),
                        ),
                      ),
                      if (!item.read)
                        Container(
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(left: 6),
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.message,
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: AppColors.slate,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        DateFormat.yMMMd().add_jm().format(item.createdAt.toLocal()),
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.muted,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      if (!item.read)
                        const Text(
                          'Tap to mark read',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
