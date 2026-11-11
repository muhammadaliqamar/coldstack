Understand the Flow of System and make it according to it


1- Using the system user can find leads from different resources (add the feature to select the source of lead scrapping)

2- After finding leads user accept the list from scrapper and it goes to contacts

3- From contacts user click verify the leads and verification (Refer to New_Features.md File)

4- After Verification User can Export the contact list in excel or csv files

5- User can connect the domain and verify the SMTP connection, based on domain the system automatically generate 3 inboxes (no need to ask user generate automatically).

6- The user has full control on generated inboxes to set the Name, edit the email/set its desired address, integrate SMTP/IMP using IMAP/SMTP settings

7- After creation of inboxes the 30 Days Warmup process will start automatically. between these 3 inboxes random emails (Gemini Generated) will be sent to each other to simulate real conversation (Refer to New_Features.md File)

8- After warmup complete the inboxes are ready and user can now create campaigns and templates(Refer to New_Features.md File)

9- After campaign is ready system start the campaign according to set limit and only send email to number of contacts within limit (e.g limit is 90 emails/day and user has 1000 contacts then system will send 90 emails/day for 11 days and the remaining 100 contacts will be sent next 11 days (random inbetween days will be skipped to show human behavior)  and so on until all contacts are sent and if campaign is stopped manually inbetween then remaining contacts will be in queue for future sending) it must rember to whom it send the last email, (e.g the system send email to 90th contact on day 1 so on day 2 it start from 91th contact not from first contact else it will send same email to first 90 contacts again). (e.g if user has 3 inboxes and 90 emails limit/day for 3 inboxes then it will send 30 emails/day/inbox to 333 contacts each (random inbetween days will be skipped to show human behavior) and so on until all contacts are sent. )

10- During campaign the system contionsly check for the stats (Refer to New_Features.md File)

11- When campaign ends the system automatically initiate the Lead nurturing sequence (Refer to New_Features.md File)
