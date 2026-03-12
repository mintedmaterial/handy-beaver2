import { Context } from 'hono';
import { adminLayout } from './admin';

export const adminCalendarPage = async (c: Context) => {
  const admin = c.get('admin');

  const content = `
    <div class="calendar-page">
      <div class="calendar-header">
        <div>
          <h1>Schedule & Calendar</h1>
          <p>View upcoming jobs and sync them with Google Calendar.</p>
        </div>
        <div class="calendar-actions">
          <input type="date" id="from-date">
          <input type="date" id="to-date">
          <button class="btn btn-secondary" onclick="loadSchedule()">Refresh</button>
        </div>
      </div>

      <div class="calendar-grid">
        <div class="card">
          <h2>Upcoming Jobs</h2>
          <div id="jobs-list" class="list-block">Loading jobs...</div>
        </div>

        <div class="card">
          <h2>Google Calendar Events</h2>
          <div id="events-list" class="list-block">Loading events...</div>
        </div>
      </div>
    </div>

    <style>
      .calendar-header { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
      .calendar-header p { color: #666; margin-top: 0.35rem; }
      .calendar-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
      .calendar-actions input { border: 1px solid #ddd; border-radius: 6px; padding: 0.5rem; }
      .calendar-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
      .list-block { display: flex; flex-direction: column; gap: 0.75rem; }
      .item { padding: 0.9rem; border: 1px solid #eee; border-radius: 8px; }
      .item h3 { margin-bottom: 0.3rem; font-size: 1rem; }
      .item p { color: #666; font-size: 0.9rem; margin-bottom: 0.3rem; }
      .item-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
      .tag { display: inline-block; border-radius: 999px; padding: 0.2rem 0.65rem; font-size: 0.75rem; font-weight: 600; }
      .tag.synced { background: #d1fae5; color: #065f46; }
      .tag.pending { background: #fef3c7; color: #92400e; }

      @media (max-width: 900px) {
        .calendar-grid { grid-template-columns: 1fr; }
      }
    </style>

    <script>
      const today = new Date();
      const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const fromInput = document.getElementById('from-date');
      const toInput = document.getElementById('to-date');
      fromInput.value = today.toISOString().split('T')[0];
      toInput.value = in30.toISOString().split('T')[0];

      async function loadSchedule() {
        const from = fromInput.value;
        const to = toInput.value;

        const [jobsRes, eventsRes] = await Promise.all([
          fetch('/api/calendar/bookings?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to)),
          fetch('/api/calendar/events?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to)),
        ]);

        const jobsData = await jobsRes.json();
        const eventsData = await eventsRes.json();

        renderJobs(jobsData.bookings || []);
        renderEvents(eventsData.events || []);
      }

      function renderJobs(jobs) {
        const el = document.getElementById('jobs-list');
        if (!jobs.length) {
          el.innerHTML = '<p style="color:#666">No scheduled jobs in this range.</p>';
          return;
        }

        el.innerHTML = jobs.map(function (job) {
          const statusClass = job.google_event_id ? 'synced' : 'pending';
          const statusLabel = job.google_event_id ? 'Synced to Google' : 'Not synced';
          const dateLabel = new Date(job.scheduled_date).toLocaleDateString();
          const openGoogle = job.google_event_link
            ? '<a class="btn btn-sm btn-secondary" href="' + job.google_event_link + '" target="_blank">Open Google Event</a>'
            : '';
          const syncButton = !job.google_event_id
            ? '<button class="btn btn-sm btn-primary" onclick="syncJob(' + job.id + ')">Sync to Google</button>'
            : '';

          return '<div class="item">'
            + '<h3>' + (job.title || job.service_type || 'Scheduled Job') + '</h3>'
            + '<p><strong>' + dateLabel + '</strong> · ' + (job.customer_name || 'Customer') + '</p>'
            + '<p>' + (job.address || '') + '</p>'
            + '<span class="tag ' + statusClass + '">' + statusLabel + '</span>'
            + '<div class="item-actions">'
            + '<a class="btn btn-sm btn-secondary" href="/admin/jobs/' + job.id + '">Open Job</a>'
            + openGoogle
            + syncButton
            + '</div>'
            + '</div>';
        }).join('');
      }

      function renderEvents(events) {
        const el = document.getElementById('events-list');
        if (!events.length) {
          el.innerHTML = '<p style="color:#666">No Google Calendar events in this range.</p>';
          return;
        }

        el.innerHTML = events.map(function (event) {
          const dateLabel = event.start ? new Date(event.start).toLocaleString() : 'No start time';
          return '<div class="item">'
            + '<h3>' + (event.title || 'Untitled Event') + '</h3>'
            + '<p>' + dateLabel + '</p>'
            + '<p>' + (event.location || '') + '</p>'
            + '</div>';
        }).join('');
      }

      async function syncJob(jobId) {
        const res = await fetch('/api/calendar/sync/' + jobId, { method: 'POST' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Failed to sync booking' }));
          alert(err.error || 'Failed to sync booking');
          return;
        }
        await loadSchedule();
      }

      loadSchedule();
    </script>
  `;

  return c.html(adminLayout('Calendar', content, 'calendar', admin));
};
