"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { startYouTubeBot } from "@/lib/youtube-bot";
import { Loader2, RefreshCcw, FileDown } from "lucide-react";
import * as XLSX from "xlsx";

interface VideoData {
  title: string;
  channelTitle: string;
  viewCount: number;
  viewsPerHour: number;
  hoursSincePublished: number;
  url: string;
}

const HomePage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoData[]>([]);

  const handleRunBot = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await startYouTubeBot();
      setVideos(result.videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = videos.map((video, index) => ({
        "S.No": index + 1,
        Title: video.title,
        Channel: video.channelTitle,
        Views: video.viewCount,
        "Views/Hour": video.viewsPerHour,
        "Hours Since Published": video.hoursSincePublished,
        URL: video.url,
      }));

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 5 }, // S.No
        { wch: 50 }, // Title
        { wch: 30 }, // Channel
        { wch: 12 }, // Views
        { wch: 12 }, // Views/Hour
        { wch: 20 }, // Hours Since Published
        { wch: 50 }, // URL
      ];
      ws["!cols"] = colWidths;

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Viral Videos");

      // Generate filename with current date and time
      const date = new Date();
      const filename = `viral_videos_${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}_${String(
        date.getHours()
      ).padStart(2, "0")}-${String(date.getMinutes()).padStart(2, "0")}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      setError("Failed to export data to Excel");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                YouTube Viral Video Tracker
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Track trending tech videos from India with real-time analytics
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                onClick={handleRunBot}
                disabled={loading}
                size="lg"
                className="flex-1 sm:flex-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>Analyzing Videos...</span>
                  </>
                ) : (
                  <>
                    <span>Run Analysis</span>
                    <RefreshCcw className="w-4 h-4" />
                  </>
                )}
              </Button>
              {videos.length > 0 && (
                <Button
                  onClick={handleExportToExcel}
                  variant="outline"
                  size="lg"
                  className="flex-1 sm:flex-none"
                >
                  <span>Export Excel</span>
                  <FileDown className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-6 py-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">Error:</span> {error}
              </div>
            </div>
          )}

          {loading && !error && (
            <div className="text-center py-12">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mx-auto"></div>
              </div>
            </div>
          )}

          {videos.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">S.No</TableHead>
                      <TableHead className="w-[300px]">Title</TableHead>
                      <TableHead className="w-[200px]">Channel</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Views/Hour</TableHead>
                      <TableHead className="text-right">Hours Old</TableHead>
                      <TableHead className="w-[100px]">Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {videos.map((video, index) => (
                      <TableRow
                        key={index}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <TableCell className="w-[50px] text-center">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium max-w-[300px] truncate">
                          {video.title}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {video.channelTitle}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {video.viewCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {video.viewsPerHour.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {video.hoursSincePublished.toFixed(1)}
                        </TableCell>
                        <TableCell>
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                          >
                            Watch
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {!loading && !error && videos.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                No videos analyzed
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Click "Run Analysis" to start tracking viral videos
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default HomePage;
