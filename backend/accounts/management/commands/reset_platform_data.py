import sys
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model
from django.apps import apps

class Command(BaseCommand):
    help = "Safely wipes all test/mock data across social, feed, calls, messages, AI chats, and users while preserving all library materials."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate deletion without committing changes to the database.',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        User = get_user_model()

        self.stdout.write(self.style.WARNING("=================================================="))
        self.stdout.write(self.style.WARNING("       MATHIFY PLATFORM CLEAN-SLATE RESET        "))
        self.stdout.write(self.style.WARNING("=================================================="))
        if dry_run:
            self.stdout.write(self.style.NOTICE("MODE: DRY RUN (No changes will be saved)\n"))
        else:
            self.stdout.write(self.style.NOTICE("MODE: LIVE EXECUTION\n"))

        # 1. Identify primary superuser
        superuser = User.objects.filter(email='ajibua@gmail.com').first()
        if not superuser:
            superuser = User.objects.filter(username='CodewithDavid').first()
        if not superuser:
            superuser = User.objects.filter(is_superuser=True).first()

        if not superuser:
            self.stderr.write(self.style.ERROR("ERROR: Could not find superuser account (CodewithDavid / ajibua@gmail.com)! Aborting."))
            return

        self.stdout.write(self.style.SUCCESS(f"Found Primary Superuser: ID={superuser.id}, username={superuser.username}, email={superuser.email}"))

        with transaction.atomic():
            # 2. Reassign all library resources to the superuser to guarantee preservation
            Resource = apps.get_model('library', 'Resource')
            Category = apps.get_model('library', 'Category')
            Bookmark = apps.get_model('library', 'Bookmark')

            total_resources = Resource.objects.count()
            self.stdout.write(f"Existing Library Resources: {total_resources}")
            self.stdout.write(f"Existing Library Categories: {Category.objects.count()}")

            reassigned = Resource.objects.exclude(uploaded_by=superuser).update(uploaded_by=superuser)
            self.stdout.write(self.style.SUCCESS(f"Reassigned {reassigned} resource(s) to superuser {superuser.username}."))

            # Delete bookmarks of non-superusers
            deleted_bookmarks, _ = Bookmark.objects.all().delete()
            self.stdout.write(f"Cleared {deleted_bookmarks} bookmarks.")

            # 3. Wipe Social & Calls
            CallSignal = apps.get_model('social', 'CallSignal')
            Call = apps.get_model('social', 'Call')
            Message = apps.get_model('social', 'Message')
            GroupJoinRequest = apps.get_model('social', 'GroupJoinRequest')
            GroupMembership = apps.get_model('social', 'GroupMembership')
            Group = apps.get_model('social', 'Group')

            c_sig, _ = CallSignal.objects.all().delete()
            c_calls, _ = Call.objects.all().delete()
            c_msg, _ = Message.objects.all().delete()
            c_req, _ = GroupJoinRequest.objects.all().delete()
            c_mem, _ = GroupMembership.objects.all().delete()
            c_grp, _ = Group.objects.all().delete()

            self.stdout.write(f"Wiped Social: {c_sig} call signals, {c_calls} calls, {c_msg} messages, {c_req} join requests, {c_mem} memberships, {c_grp} groups.")

            # 4. Wipe Feed
            Like = apps.get_model('feed', 'Like')
            Comment = apps.get_model('feed', 'Comment')
            Follow = apps.get_model('feed', 'Follow')
            Post = apps.get_model('feed', 'Post')

            c_likes, _ = Like.objects.all().delete()
            c_comms, _ = Comment.objects.all().delete()
            c_folls, _ = Follow.objects.all().delete()
            c_posts, _ = Post.objects.all().delete()

            self.stdout.write(f"Wiped Feed: {c_likes} likes, {c_comms} comments, {c_folls} follows, {c_posts} posts.")

            # 5. Wipe AI Tutor & Notifications
            Notification = apps.get_model('notifications', 'Notification')
            SessionMessage = apps.get_model('ai_tutor', 'SessionMessage')
            ChatSession = apps.get_model('ai_tutor', 'ChatSession')
            TutorProfile = apps.get_model('ai_tutor', 'TutorProfile')

            c_notifs, _ = Notification.objects.all().delete()
            c_sm, _ = SessionMessage.objects.all().delete()
            c_cs, _ = ChatSession.objects.all().delete()
            c_tp, _ = TutorProfile.objects.all().delete()

            self.stdout.write(f"Wiped AI Tutor & Notifications: {c_notifs} notifications, {c_sm} messages, {c_cs} sessions, {c_tp} tutor profiles.")

            # 6. Wipe Rankings & Competitions
            QuestionSubmission = apps.get_model('rankings', 'QuestionSubmission')
            CompetitionParticipant = apps.get_model('rankings', 'CompetitionParticipant')
            Score = apps.get_model('rankings', 'Score')
            UserBadge = apps.get_model('rankings', 'UserBadge')
            CompetitionQuestion = apps.get_model('rankings', 'CompetitionQuestion')
            Competition = apps.get_model('rankings', 'Competition')

            QuestionSubmission.objects.all().delete()
            CompetitionParticipant.objects.all().delete()
            Score.objects.all().delete()
            UserBadge.objects.all().delete()
            CompetitionQuestion.objects.all().delete()
            Competition.objects.all().delete()
            self.stdout.write("Wiped Rankings, Competitions, and User Badges.")

            # 7. Wipe Studio
            Creation = apps.get_model('studio', 'Creation')
            Formula = apps.get_model('studio', 'Formula')
            Creation.objects.all().delete()
            Formula.objects.all().delete()
            self.stdout.write("Wiped Studio creations and formulas.")

            # 8. Reset Superuser profile stats to 0
            Profile = apps.get_model('accounts', 'Profile')
            su_profile, _ = Profile.objects.get_or_create(user=superuser)
            su_profile.axiom_points = 0
            su_profile.save()
            self.stdout.write(f"Reset superuser {superuser.username} profile axiom_points to 0.")

            # 9. Delete all other users
            deleted_users_qs = User.objects.exclude(id=superuser.id)
            deleted_users_count = deleted_users_qs.count()
            deleted_users_qs.delete()
            self.stdout.write(self.style.SUCCESS(f"Deleted {deleted_users_count} other user accounts."))

            # 10. Final sanity checks
            remaining_resources = Resource.objects.count()
            remaining_categories = Category.objects.count()
            remaining_users = User.objects.count()

            self.stdout.write("\n" + "="*50)
            self.stdout.write(self.style.SUCCESS("FINAL VERIFICATION SUMMARY:"))
            self.stdout.write(f" - Preserved Library Resources : {remaining_resources} (Expected: {total_resources})")
            self.stdout.write(f" - Preserved Library Categories: {remaining_categories}")
            self.stdout.write(f" - Active Users                : {remaining_users} (Superuser {superuser.username})")
            self.stdout.write(f" - Posts                       : {Post.objects.count()}")
            self.stdout.write(f" - Groups                      : {Group.objects.count()}")
            self.stdout.write(f" - Calls                       : {Call.objects.count()}")
            self.stdout.write(f" - Messages                    : {Message.objects.count()}")
            self.stdout.write(f" - AI Sessions                 : {ChatSession.objects.count()}")
            self.stdout.write("="*50 + "\n")

            if dry_run:
                transaction.set_rollback(True)
                self.stdout.write(self.style.NOTICE("DRY RUN COMPLETE: All changes rolled back."))
            else:
                self.stdout.write(self.style.SUCCESS("PLATFORM CLEAN-SLATE RESET COMPLETED SUCCESSFULLY!"))
